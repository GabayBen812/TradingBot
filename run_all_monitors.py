#!/usr/bin/env python3
"""
Combined Monitor Launcher

This script runs both Fibonacci monitors and Strategy monitors together.
You can run them in separate processes or choose which one to run.
"""

import os
import sys
import subprocess
import time
import signal
import threading
from pathlib import Path

def run_fibonacci_monitors():
    """Run Fibonacci monitors"""
    print("🚀 Starting Fibonacci Monitors...")
    fib_path = Path("fibonacci_monitors/mega_monitor.py")
    if fib_path.exists():
        try:
            subprocess.run([sys.executable, str(fib_path)], check=True)
        except KeyboardInterrupt:
            print("⏹️  Fibonacci monitors stopped by user")
        except Exception as e:
            print(f"❌ Error running Fibonacci monitors: {e}")
    else:
        print("❌ Fibonacci monitor script not found")

def run_enhanced_fibonacci_monitors():
    """Run Enhanced Fibonacci monitors with position management"""
    print("🚀 Starting Enhanced Fibonacci Monitors with Position Management...")
    enhanced_fib_path = Path("fibonacci_monitors/enhanced_mega_monitor.py")
    if enhanced_fib_path.exists():
        try:
            subprocess.run([sys.executable, str(enhanced_fib_path)], check=True)
        except KeyboardInterrupt:
            print("⏹️  Enhanced Fibonacci monitors stopped by user")
        except Exception as e:
            print(f"❌ Error running Enhanced Fibonacci monitors: {e}")
    else:
        print("❌ Enhanced Fibonacci monitor script not found")

def run_strategy_monitors():
    """Run Strategy monitors"""
    print("🚀 Starting Strategy Monitors...")
    strat_path = Path("strategy_monitors/strategy_monitor.py")
    if strat_path.exists():
        try:
            subprocess.run([sys.executable, str(strat_path)], check=True)
        except KeyboardInterrupt:
            print("⏹️  Strategy monitors stopped by user")
        except Exception as e:
            print(f"❌ Error running Strategy monitors: {e}")
    else:
        print("❌ Strategy monitor script not found")

def run_both_parallel():
    """Run both monitors in parallel"""
    print("🚀 Starting ALL MONITORS in parallel...")
    print("=" * 60)
    
    # Start Fibonacci monitors in a separate thread
    fib_thread = threading.Thread(target=run_fibonacci_monitors, daemon=True)
    fib_thread.start()
    
    # Wait a moment for Fibonacci monitors to initialize
    time.sleep(2)
    
    # Start Strategy monitors in main thread
    run_strategy_monitors()

def run_enhanced_both_parallel():
    """Run enhanced Fibonacci monitors and Strategy monitors in parallel"""
    print("🚀 Starting ENHANCED MONITORS in parallel...")
    print("=" * 60)
    
    # Start Enhanced Fibonacci monitors in a separate thread
    enhanced_fib_thread = threading.Thread(target=run_enhanced_fibonacci_monitors, daemon=True)
    enhanced_fib_thread.start()
    
    # Wait a moment for Enhanced Fibonacci monitors to initialize
    time.sleep(2)
    
    # Start Strategy monitors in main thread
    run_strategy_monitors()

def main():
    """Main launcher function"""
    print("🎯 Trading Bot Monitor Launcher")
    print("=" * 40)
    print("1. Run Fibonacci Monitors only")
    print("2. Run Strategy Monitors only") 
    print("3. Run BOTH monitors in parallel")
    print("4. Run ENHANCED Fibonacci Monitors (with Position Management)")
    print("5. Run ENHANCED BOTH monitors in parallel")
    print("6. Exit")
    print("=" * 40)
    
    while True:
        try:
            choice = input("\nSelect option (1-6): ").strip()
            
            if choice == "1":
                run_fibonacci_monitors()
                break
            elif choice == "2":
                run_strategy_monitors()
                break
            elif choice == "3":
                run_both_parallel()
                break
            elif choice == "4":
                run_enhanced_fibonacci_monitors()
                break
            elif choice == "5":
                run_enhanced_both_parallel()
                break
            elif choice == "6":
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please select 1-6.")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
            break

if __name__ == "__main__":
    main() 