import nmap
import re

def get_local_network_prefix():
    """
    Attempts to determine the local network prefix (e.g., 192.168.1).
    This is a simplified approach and might not work in all network configurations.
    """
    try:
        import netifaces
        for iface in netifaces.interfaces():
            ifaddresses = netifaces.ifaddresses(iface)
            if netifaces.AF_INET in ifaddresses:
                for link_addr in ifaddresses[netifaces.AF_INET]:
                    ip = link_addr['addr']
                    # Basic check for common private IP ranges
                    if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
                        return '.'.join(ip.split('.')[:3]) + '.'
    except ImportError:
        print("netifaces library not found. Falling back to common default.")
        # Fallback or prompt user if netifaces is not available
        pass # Let the more robust nmap scan handle it, or prompt user
    return "192.168.1." # Common default, but nmap will scan broader if needed

def scan_network(network_prefix=""):
    """
    Scans the local network for connected devices and gathers information.

    Args:
        network_prefix (str, optional): The network prefix to scan (e.g., "192.168.1.").
                                         If empty, tries to determine it or uses nmap's local network capabilities.
    Returns:
        list: A list of dictionaries, where each dictionary represents a device
              and contains its IP address, MAC address (if available),
              vendor (if available), and open ports.
    """
    nm = nmap.PortScanner()
    devices = []

    # If no prefix is provided, nmap can often figure out the local network.
    # However, providing a more specific target can be faster.
    # For a general local network scan, '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12' are common.
    # We'll try a common default range if no prefix is given.
    scan_target = f"{network_prefix}0/24" if network_prefix else "192.168.1.0/24" # Default to /24 of common prefix
    print(f"Scanning target: {scan_target} ... (This may take a few minutes)")

    try:
        # -sn: Ping scan (no port scan initially, faster for discovery)
        # -T4: Aggressive timing for faster scans
        # We will do a more detailed scan on discovered hosts later.
        nm.scan(hosts=scan_target, arguments='-sn -T4')
    except nmap.nmap.PortScannerError as e:
        print(f"Nmap scan error: {e}")
        print("Please ensure Nmap is installed and in your system's PATH.")
        print("You can typically install it using your system's package manager (e.g., 'sudo apt install nmap' on Debian/Ubuntu, 'brew install nmap' on macOS).")
        return devices
    except Exception as e:
        print(f"An unexpected error occurred during the initial scan: {e}")
        return devices

    discovered_hosts = nm.all_hosts()
    if not discovered_hosts:
        print(f"No hosts found on {scan_target}. Trying a broader scan...")
        # Try a broader scan if the default didn't work
        common_private_ranges = ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']
        for scan_range in common_private_ranges:
            print(f"Scanning target: {scan_range} ...")
            try:
                nm.scan(hosts=scan_range, arguments='-sn -T4')
                discovered_hosts = nm.all_hosts()
                if discovered_hosts:
                    print(f"Found hosts in range: {scan_range}")
                    break
            except Exception:
                continue # Try next range
        if not discovered_hosts:
            print("No hosts found on common private IP ranges.")
            return devices

    print(f"\nDiscovered {len(discovered_hosts)} host(s). Now scanning for more details...")

    for host_ip in discovered_hosts:
        if host_ip == '127.0.0.1': # Skip localhost
            continue
        print(f"\nScanning host: {host_ip}")
        device_info = {'ip': host_ip, 'mac': 'N/A', 'vendor': 'N/A', 'open_ports': [], 'hostname': 'N/A', 'os': 'N/A'}
        try:
            # -O: Enable OS detection
            # -sV: Probe open ports to determine service/version info
            # --top-ports 20: Scan the top 20 most common ports for speed.
            #                 For a more thorough scan, remove or increase this.
            # -T4: Aggressive timing
            # Nmap needs root/administrator privileges for OS detection and some scan types.
            # If not run as root, OS detection might fail silently or provide limited results.
            scan_args = '-T4 -sV --top-ports 20'
            try: # Try with OS detection
                nm.scan(hosts=host_ip, arguments=scan_args + ' -O')
            except nmap.nmap.PortScannerError:
                # If OS detection fails (e.g., due to permissions), try without it
                print(f"OS detection failed for {host_ip} (possibly needs root/admin privileges). Scanning without OS detection.")
                nm.scan(hosts=host_ip, arguments=scan_args)


            if host_ip not in nm.all_hosts() or 'addresses' not in nm[host_ip]:
                print(f"Could not retrieve detailed info for {host_ip}")
                continue

            if 'mac' in nm[host_ip]['addresses']:
                device_info['mac'] = nm[host_ip]['addresses']['mac']
                if device_info['mac'] in nm[host_ip]['vendor']:
                    device_info['vendor'] = nm[host_ip]['vendor'][device_info['mac']]

            if 'hostnames' in nm[host_ip] and nm[host_ip]['hostnames']:
                # Taking the first hostname if multiple exist
                device_info['hostname'] = nm[host_ip]['hostnames'][0]['name'] if nm[host_ip]['hostnames'][0]['name'] else 'N/A'


            if 'osmatch' in nm[host_ip] and nm[host_ip]['osmatch']:
                # Taking the first OS match with the highest accuracy
                best_osmatch = sorted(nm[host_ip]['osmatch'], key=lambda x: int(x['accuracy']), reverse=True)[0]
                device_info['os'] = f"{best_osmatch['name']} (Accuracy: {best_osmatch['accuracy']}%)"
                if 'osclass' in best_osmatch and best_osmatch['osclass']:
                     os_class_info = best_osmatch['osclass'][0]
                     device_info['os_details'] = f"Type: {os_class_info.get('type', 'N/A')}, Vendor: {os_class_info.get('vendor', 'N/A')}, Family: {os_class_info.get('osfamily', 'N/A')}, Gen: {os_class_info.get('osgen', 'N/A')}"


            if 'tcp' in nm[host_ip]:
                for port, port_info in nm[host_ip]['tcp'].items():
                    if port_info['state'] == 'open':
                        service_name = port_info.get('name', 'unknown')
                        product = port_info.get('product', '')
                        version = port_info.get('version', '')
                        service_details = f"{service_name} {product} {version}".strip()
                        device_info['open_ports'].append(f"{port}/tcp ({service_details})")
            devices.append(device_info)

        except KeyError as e:
            print(f"KeyError while processing host {host_ip}: {e}. Skipping some details for this host.")
            # Add what we have so far, even if some details are missing
            if device_info['ip']: # ensure at least IP is there
                 devices.append(device_info)
        except nmap.nmap.PortScannerError as e:
            print(f"Nmap error scanning host {host_ip}: {e}")
        except Exception as e:
            print(f"An unexpected error occurred while scanning host {host_ip}: {e}")

    return devices

if __name__ == "__main__":
    print("Attempting to discover local network prefix...")
    # We won't use get_local_network_prefix directly in scan_network anymore,
    # as nmap's own discovery or broader scans are more reliable.
    # network_prefix = get_local_network_prefix()
    # print(f"Using network prefix for initial scan: {network_prefix if network_prefix else 'Nmap default/broad scan'}")

    print("Starting network scan...")
    # Pass an empty string to let scan_network handle discovery,
    # or specify a prefix like "192.168.1." if you know it.
    found_devices = scan_network()

    if found_devices:
        print("\n--- Scan Results ---")
        for i, device in enumerate(found_devices):
            print(f"\nDevice #{i+1}:")
            print(f"  IP Address: {device['ip']}")
            print(f"  MAC Address: {device['mac']}")
            print(f"  Vendor: {device['vendor']}")
            print(f"  Hostname: {device['hostname']}")
            print(f"  Operating System: {device.get('os', 'N/A')}")
            if 'os_details' in device:
                print(f"  OS Details: {device['os_details']}")
            if device['open_ports']:
                print("  Open Ports:")
                for port_info in device['open_ports']:
                    print(f"    - {port_info}")
            else:
                print("  Open Ports: None found (or not scanned)")
    else:
        print("\nNo devices found or scan failed. Some things to check:")
        print("- Ensure Nmap is installed and in your system's PATH.")
        print("- Try running the script with sudo/administrator privileges for more detailed scans (like OS detection).")
        print("- Check your network connection and firewall settings.")
        print("- If you know your network range (e.g., 192.168.0.0/24), you can modify the 'scan_target' in the script.")

    print("\nNote: MAC addresses and OS detection are more reliable when the script is run with root/administrator privileges.")
    print("OS detection also depends on the target device's firewall and OS configuration.")
