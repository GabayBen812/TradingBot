@echo off
echo 🎯 Trading Bot Monitor Launcher
echo ========================================
echo.
echo Choose an option:
echo 1. Run Fibonacci Monitors only
echo 2. Run Strategy Monitors only
echo 3. Run BOTH monitors (separate windows)
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo 🚀 Starting Fibonacci Monitors...
    cd fibonacci_monitors
    python mega_monitor.py
    goto end
)

if "%choice%"=="2" (
    echo 🚀 Starting Strategy Monitors...
    cd strategy_monitors
    python strategy_monitor.py
    goto end
)

if "%choice%"=="3" (
    echo 🚀 Starting BOTH monitors in separate windows...
    start "Fibonacci Monitors" cmd /k "cd fibonacci_monitors && python mega_monitor.py"
    timeout /t 3 /nobreak >nul
    start "Strategy Monitors" cmd /k "cd strategy_monitors && python strategy_monitor.py"
    echo ✅ Both monitors started in separate windows
    echo 💡 Close the windows individually to stop the monitors
    goto end
)

if "%choice%"=="4" (
    echo 👋 Goodbye!
    goto end
)

echo ❌ Invalid choice. Please run the script again.
:end
pause 