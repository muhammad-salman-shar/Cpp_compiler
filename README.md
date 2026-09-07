# C++ Compiler Offline

An Android-packaged version of the existing C++ Compiler Lite web application.

## Runtime

The compiler/interpreter UI and compiler logic are bundled into the APK.
After installation, compiling/running supported C++ code does not require an
internet connection.

## Android build

GitHub Actions builds the Vite app, creates the Android project with
Capacitor, syncs the bundled `dist/` files into the Android app, and produces
a debug APK.

The current compiler is the existing TypeScript interpreter in `src/compiler`.
This is **not** a full GCC/Clang toolchain; it supports the C++ subset already
implemented by the project.
