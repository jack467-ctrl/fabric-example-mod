from operations import add, subtract, multiply, divide

def main():
    """Runs the calculator CLI."""
    print("Simple Calculator")
    print("Operations: +, -, *, /")

    while True:
        try:
            num1_str = input("Enter the first number: ")
            if num1_str.lower() == 'quit':
                break
            num1 = float(num1_str)

            op = input("Enter operation (+, -, *, /): ")
            if op.lower() == 'quit':
                break

            num2_str = input("Enter the second number: ")
            if num2_str.lower() == 'quit':
                break
            num2 = float(num2_str)

            if op == '+':
                result = add(num1, num2)
            elif op == '-':
                result = subtract(num1, num2)
            elif op == '*':
                result = multiply(num1, num2)
            elif op == '/':
                result = divide(num1, num2)
            else:
                print("Invalid operation. Please use +, -, *, or /.")
                continue

            print(f"Result: {num1} {op} {num2} = {result}")

        except ValueError as e:
            if "could not convert string to float" in str(e):
                print("Invalid input. Please enter numbers.")
            else:
                print(f"Error: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

        print("-" * 20)

if __name__ == "__main__":
    main()
