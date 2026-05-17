const TEMPLATES = {
  python: `print("Hello, World!")`,
  javascript: `console.log("Hello, World!");`,
  c: `#include <stdio.h>\nint main() { printf("Hello, World!\\n"); return 0; }`,
  cpp: `#include <iostream>\nint main() { std::cout << "Hello, World!" << std::endl; return 0; }`,
  java: `public class Main { public static void main(String[] args) { System.out.println("Hello, World!"); } }`,
  typescript: `console.log("Hello, World!");`
}

export default TEMPLATES
