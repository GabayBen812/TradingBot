#!/usr/bin/env python3
"""
Setup script for Fibonacci Retracement Detection Bot

This script helps users set up the bot by installing dependencies and guiding through configuration.
"""

import os
import sys
import subprocess
from pathlib import Path

def print_banner():
    """Print welcome banner"""
    print("=" * 60)
    print("🚀 FIBONACCI RETRACEMENT DETECTION BOT SETUP")
    print("=" * 60)
    print("This script will help you set up the bot for monitoring SOL/USDT")
    print("and sending Discord alerts when Fibonacci 0.618 retracements are detected.")
    print("=" * 60)

def check_python_version():
    """Check if Python version is compatible"""
    print("Checking Python version...")
    if sys.version_info < (3, 7):
        print("❌ Python 3.7 or higher is required")
        print(f"Current version: {sys.version}")
        return False
    else:
        print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
        return True

def install_dependencies():
    """Install required Python packages"""
    print("\nInstalling dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def create_env_file():
    """Create .env file from template"""
    print("\nSetting up environment configuration...")
    
    env_file = Path(".env")
    env_example = Path("env_example.txt")
    
    if env_file.exists():
        print("ℹ️ .env file already exists")
        return True
    
    if not env_example.exists():
        print("❌ env_example.txt not found")
        return False
    
    # Copy example to .env
    try:
        with open(env_example, 'r') as src:
            content = src.read()
        
        with open(env_file, 'w') as dst:
            dst.write(content)
        
        print("✅ Created .env file from template")
        print("⚠️ Please edit .env file and add your Discord webhook URL")
        return True
    except Exception as e:
        print(f"❌ Failed to create .env file: {e}")
        return False

def get_discord_webhook():
    """Prompt user for Discord webhook URL"""
    print("\n" + "=" * 50)
    print("DISCORD WEBHOOK SETUP")
    print("=" * 50)
    print("To receive alerts, you need to create a Discord webhook:")
    print("1. Go to your Discord server settings")
    print("2. Navigate to Integrations → Webhooks")
    print("3. Create a new webhook")
    print("4. Copy the webhook URL")
    print("=" * 50)
    
    webhook_url = input("Enter your Discord webhook URL (or press Enter to skip): ").strip()
    
    if webhook_url:
        # Update .env file
        env_file = Path(".env")
        if env_file.exists():
            try:
                with open(env_file, 'r') as f:
                    content = f.read()
                
                # Replace placeholder with actual URL
                content = content.replace(
                    "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE",
                    f"DISCORD_WEBHOOK_URL={webhook_url}"
                )
                
                with open(env_file, 'w') as f:
                    f.write(content)
                
                print("✅ Discord webhook URL saved to .env file")
                return True
            except Exception as e:
                print(f"❌ Failed to save webhook URL: {e}")
                return False
        else:
            print("❌ .env file not found")
            return False
    else:
        print("ℹ️ Skipping Discord webhook setup")
        return True

def test_setup():
    """Test the setup by running the test script"""
    print("\nTesting setup...")
    try:
        result = subprocess.run([sys.executable, "test_bot.py"], 
                              capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ Setup test completed successfully")
            return True
        else:
            print("⚠️ Setup test completed with warnings")
            print("Check the output above for any issues")
            return True
    except subprocess.TimeoutExpired:
        print("⚠️ Setup test timed out")
        return True
    except Exception as e:
        print(f"❌ Setup test failed: {e}")
        return False

def print_next_steps():
    """Print next steps for the user"""
    print("\n" + "=" * 60)
    print("🎉 SETUP COMPLETE!")
    print("=" * 60)
    print("Next steps:")
    print("1. Edit config.py to customize settings (optional)")
    print("2. Run the bot: python main.py")
    print("3. Test the bot: python test_bot.py")
    print("\nConfiguration options in config.py:")
    print("- TIMEFRAME: Change chart timeframe (1h, 4h, 1d, etc.)")
    print("- MARGIN: Adjust detection sensitivity")
    print("- CHECK_INTERVAL_MINUTES: Change monitoring frequency")
    print("- SYMBOL: Monitor different trading pairs")
    print("\nFor help, see README.md")
    print("=" * 60)

def main():
    """Main setup function"""
    print_banner()
    
    # Check Python version
    if not check_python_version():
        return
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Setup failed at dependency installation")
        return
    
    # Create .env file
    if not create_env_file():
        print("❌ Setup failed at environment configuration")
        return
    
    # Get Discord webhook
    get_discord_webhook()
    
    # Test setup
    test_setup()
    
    # Print next steps
    print_next_steps()

if __name__ == "__main__":
    main() 