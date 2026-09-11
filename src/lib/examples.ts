export interface Example {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  code: string;
  stdin?: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "hello",
    title: "Hello, World",
    blurb: "The classic first program — streaming output with cout.",
    tags: ["basics", "cout"],
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, world!" << endl;
    cout << "Compiled and executed right in your browser." << endl;
    return 0;
}
`,
  },
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    blurb: "for-loops, modulo arithmetic and an if / else-if chain.",
    tags: ["loops", "branching"],
    code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 1; i <= 30; i++) {
        if (i % 15 == 0)     cout << "FizzBuzz" << endl;
        else if (i % 3 == 0) cout << "Fizz" << endl;
        else if (i % 5 == 0) cout << "Buzz" << endl;
        else                 cout << i << endl;
    }
    return 0;
}
`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci Sequence",
    blurb: "Grows a std::vector with push_back until it holds 16 terms.",
    tags: ["vector", "while"],
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> fib = {0, 1};

    while (fib.size() < 16) {
        int n = fib.size();
        fib.push_back(fib[n - 1] + fib[n - 2]);
    }

    for (int i = 0; i < fib.size(); i++) {
        cout << "fib(" << i << ") = " << fib[i] << endl;
    }
    return 0;
}
`,
  },
  {
    id: "functions",
    title: "Recursion & Predicates",
    blurb: "A recursive factorial plus an isPrime helper function.",
    tags: ["functions", "recursion"],
    code: `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

bool isPrime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; d++) {
        if (n % d == 0) return false;
    }
    return true;
}

int main() {
    for (int n = 1; n <= 10; n++)
        cout << n << "! = " << factorial(n) << endl;

    cout << "primes below 40:" << endl;
    for (int n = 2; n < 40; n++) {
        if (isPrime(n)) cout << n << " ";
    }
    cout << endl;
    return 0;
}
`,
  },
  {
    id: "sort",
    title: "Bubble Sort by Reference",
    blurb: "swap(int&, int&) shows pass-by-reference mutating the caller's vector.",
    tags: ["references", "sorting"],
    code: `#include <iostream>
#include <vector>
using namespace std;

void swap(int &a, int &b) {
    int t = a;
    a = b;
    b = t;
}

int main() {
    vector<int> data = {38, 7, 91, 2, 45, 16, 73};

    for (int i = 0; i < data.size(); i++)
        for (int j = 0; j < data.size() - 1 - i; j++)
            if (data[j] > data[j + 1])
                swap(data[j], data[j + 1]);

    cout << "sorted: ";
    for (int x : data) cout << x << " ";
    cout << endl;
    return 0;
}
`,
  },
  {
    id: "strings",
    title: "Strings & getline",
    blurb: "Reads a full line from stdin, then walks it char by char.",
    tags: ["strings", "stdin"],
    stdin: "Ada Lovelace",
    code: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "What is your name? ";
    getline(cin, name);

    string shout = "";
    for (char c : name) {
        shout += toupper(c);
    }

    cout << "Hello, " << name << "!" << endl;
    cout << "In uppercase: " << shout << endl;
    cout << "Your name has " << name.size() << " characters." << endl;
    return 0;
}
`,
  },
  {
    id: "cin",
    title: "Reading Numbers",
    blurb: "cin >> reads whitespace-separated tokens from the STDIN panel.",
    tags: ["cin", "arithmetic"],
    stdin: "17 5",
    code: `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cout << "Enter two numbers: ";
    cin >> a >> b;

    cout << "sum      = " << a + b << endl;
    cout << "product  = " << a * b << endl;
    if (b != 0)
        cout << "quotient = " << a / b << "  remainder " << a % b << endl;
    else
        cout << "cannot divide by zero" << endl;
    return 0;
}
`,
  },
  {
    id: "broken",
    title: "Diagnostics Demo",
    blurb: "Deliberately broken — a missing semicolon and an unused variable. Run it and read the compiler's report.",
    tags: ["errors", "diagnostics"],
    code: `#include <iostream>
using namespace std;

int main() {
    int unused = 7;
    int answer = 41
    answer = answer + 1;
    cout << "the answer is " << answer << endl;
    return 0;
}
`,
  },
  {
    id: "arrays",
    title: "C-style Arrays",
    blurb: "Fixed-size arrays with initialization and element access.",
    tags: ["arrays", "loops"],
    code: `#include <iostream>
using namespace std;

int main() {
    // Declare and initialize an array
    int arr[5] = {10, 20, 30, 40, 50};
    
    cout << "Array elements:" << endl;
    for (int i = 0; i < 5; i++) {
        cout << "arr[" << i << "] = " << arr[i] << endl;
    }
    
    // Modify elements
    arr[2] = 99;
    cout << "\\nAfter modification:" << endl;
    cout << "arr[2] = " << arr[2] << endl;
    
    // Array without initialization
    int nums[3];
    nums[0] = 1;
    nums[1] = 2;
    nums[2] = 3;
    
    cout << "\\nSecond array: ";
    for (int i = 0; i < 3; i++) {
        cout << nums[i] << " ";
    }
    cout << endl;
    
    return 0;
}
`,
  },
];
