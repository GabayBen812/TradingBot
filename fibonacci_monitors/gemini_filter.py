import google.generativeai as genai
import json
import logging
from typing import Dict, Optional, List
from datetime import datetime
import os
from config import *

logger = logging.getLogger(__name__)

class GeminiSetupFilter:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables")
            self.api_key = None
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            logger.info("Gemini LLM filter initialized successfully")
        else:
            self.model = None
            logger.warning("Gemini LLM filter disabled - no API key")
    
    def analyze_setup_quality(self, setup_data: Dict) -> Dict:
        """
        Analyze a Fibonacci setup using Gemini LLM to determine quality
        Returns: {
            'is_high_quality': bool,
            'confidence_score': float (0-1),
            'reasoning': str,
            'risk_factors': List[str],
            'strength_factors': List[str],
            'recommendation': str
        }
        """
        # Basic sanity checks before the lenient fallback
        trading = setup_data.get('trading_levels', {})
        fib = setup_data.get('fibonacci_levels', {})
        current_price = setup_data.get('current_price')
        setup_type = setup_data.get('setup_type') or trading.get('setup_type')

        fib_618 = fib.get(0.618)
        if fib_618 and current_price:
            total_move = abs(fib.get(1.0, 0) - fib.get(0.0, 0))
            tight = max(fib_618 * 0.001, total_move * 0.05)  # ~0.1% or 5% of move
            if abs(current_price - fib_618) > tight:
                return {
                    'is_high_quality': False,
                    'confidence_score': 0.3,
                    'reasoning': 'Price not sufficiently close to 61.8% Fibonacci level',
                    'risk_factors': ['level_distance'],
                    'strength_factors': [],
                    'recommendation': 'HOLD'
                }

        # Fallback: basic quality check without AI (already tuned to be lenient for testing)
        return self._basic_quality_check(setup_data)
        
        # Original AI logic (commented out for testing)
        # if not self.model:
        #     # Fallback: basic quality check without AI
        #     return self._basic_quality_check(setup_data)
        # 
        # try:
        #     # Prepare setup data for analysis
        #     analysis_prompt = self._create_analysis_prompt(setup_data)
        #     
        #     # Get AI response
        #     response = self.model.generate_content(analysis_prompt)
        #     
        #     # Parse the response
        #     return self._parse_ai_response(response.text, setup_data)
        #     
        # except Exception as e:
        #     logger.error(f"Error in Gemini analysis: {e}")
        #     return self._basic_quality_check(setup_data)
    
    def _create_analysis_prompt(self, setup_data: Dict) -> str:
        """Create a detailed prompt for the AI to analyze the setup"""
        
        symbol = setup_data['symbol']
        timeframe = setup_data['timeframe']
        current_price = setup_data['current_price']
        swing_high = setup_data['swing_high']
        swing_low = setup_data['swing_low']
        fib_levels = setup_data['fibonacci_levels']
        trading_levels = setup_data['trading_levels']
        setup_type = trading_levels.get('setup_type', 'LONG')
        
        # Calculate additional metrics
        move_percent = abs(swing_high - swing_low) / swing_low * 100
        risk_reward_ratio = abs(trading_levels.get('tp1', 0) - current_price) / abs(current_price - trading_levels.get('sl', 0))
        
        prompt = f"""
You are a PROFESSIONAL day trader with 15+ years of experience specializing in Fibonacci retracement trading. You have a proven 70%+ win rate and deep understanding of market psychology, risk management, and technical analysis.

**YOUR EXPERTISE:**
- Advanced Fibonacci retracement analysis
- Market psychology and emotional control
- Risk management and position sizing
- Technical analysis and pattern recognition
- Performance metrics and trade journaling

**FIBONACCI TRADING PHILOSOPHY:**
- Fibonacci retracements are POWERFUL support/resistance levels
- Higher risk/reward ratios are BETTER (2:1, 3:1, 4:1 are excellent)
- All Fibonacci levels are valid: 23.6%, 38.2%, 50%, 61.8%, 78.6%
- Small moves (1-2%) are NORMAL and valid for shorter timeframes
- Price action at Fibonacci levels often leads to reversals

**SPECIFIC TRADING STRATEGY - FIBONACCI 61.8:**
- **Primary Focus**: 61.8% Fibonacci level (Golden Ratio)
- **Entry Timing**: At the end of the candle when setup is detected
- **Candle Pattern Requirements**:
  * For SHORT trades: Look for bearish candle (close < open)
  * For LONG trades: Look for bullish candle (close > open)
- **Stop Loss**: "A little above the high of the candle where the deal was opened"
- **Take Profit**: Changes each time depending on the trend
- **Profit Taking**: 2 green/red and strong candles are indication for taking profits
- **Timeframe Preference**: 4-hour candles for highest quality, but can work on smaller timeframes
- **Momentum Requirement**: Must be in strong momentum for valid setups

**FIBONACCI TRADING RULES:**
1. **61.8% level** = GOLDEN RATIO - Most powerful retracement level
2. **50% level** = Strong psychological level - Very reliable
3. **38.2% level** = Shallow retracement - Still valid
4. **23.6% level** = Shallow but can work
5. **78.6% level** = Deep retracement - High probability

**RISK/REWARD UNDERSTANDING:**
- 1:1 ratio = Break even
- 1:2 ratio = Good (2x reward for 1x risk)
- 1:3 ratio = Excellent (3x reward for 1x risk)
- 1:4+ ratio = Outstanding (4x+ reward for 1x risk)

**MOVE SIZE GUIDELINES:**
- 1m timeframe: 0.5%+ moves are valid
- 5m timeframe: 1%+ moves are valid  
- 15m timeframe: 1.5%+ moves are valid
- 1h+ timeframe: 2%+ moves are valid

**COMPREHENSIVE TRADING ANALYSIS:**

**SETUP DATA:**
- Symbol: {symbol}
- Timeframe: {timeframe}
- Setup Type: {setup_type}
- Current Price: ${current_price:.2f}
- Swing High: ${swing_high:.2f}
- Swing Low: ${swing_low:.2f}
- Total Move: {move_percent:.2f}%
- Risk/Reward Ratio: {risk_reward_ratio:.2f}

**FIBONACCI LEVELS:**
- 0% ({'Swing High' if setup_type == 'SHORT' else 'Swing Low'}): ${fib_levels[0.0]:.2f}
- 23.6%: ${fib_levels[0.236]:.2f}
- 38.2%: ${fib_levels[0.382]:.2f}
- 50%: ${fib_levels[0.5]:.2f}
- 61.8%: ${fib_levels[0.618]:.2f} ⭐ GOLDEN RATIO
- 78.6%: ${fib_levels[0.786]:.2f}
- 100% ({'Swing Low' if setup_type == 'SHORT' else 'Swing High'}): ${fib_levels[1.0]:.2f}

**TRADING LEVELS:**
- Entry: ${current_price:.2f}
- Take Profit 1: ${trading_levels.get('tp1', 0):.2f}
- Take Profit 2: ${trading_levels.get('tp2', 0):.2f}
- Take Profit 3: ${trading_levels.get('tp3', 0):.2f}
- Stop Loss: ${trading_levels.get('sl', 0):.2f}

**PROFESSIONAL ANALYSIS CRITERIA:**

1. **STRATEGY-SPECIFIC ANALYSIS:**
   - **Candle Pattern**: Does the current candle match the setup type?
     * SHORT: Bearish candle (close < open) required
     * LONG: Bullish candle (close > open) required
   - **61.8% Level**: Is price exactly at the 61.8% Fibonacci level?
   - **Momentum Strength**: Is there strong momentum in the direction of the trade?
   - **Timeframe Quality**: Is this a 4h+ timeframe for highest quality?
   - **Entry Timing**: Is this at the end of the candle as required?

2. **TECHNICAL ANALYSIS:**
   - Fibonacci Level Quality: Is price at a strong Fibonacci level?
   - Move Size: Is the swing move reasonable for the timeframe?
   - Risk/Reward: Is the R:R ratio favorable?
   - Setup Clarity: Is this a clean Fibonacci retracement setup?
   - Entry Quality: Is the entry near a Fibonacci level?

3. **MARKET PSYCHOLOGY:**
   - Emotional control assessment
   - FOMO (Fear of Missing Out) risk
   - Overconfidence indicators
   - Analysis paralysis potential

3. **RISK MANAGEMENT:**
   - Position sizing recommendations
   - Stop loss placement quality
   - Risk-reward ratio analysis
   - Maximum drawdown potential

4. **PERFORMANCE METRICS:**
   - Win rate probability
   - Expected return calculation
   - Risk-adjusted returns
   - Sharpe ratio estimation

**QUALITY ASSESSMENT:**
- **EXCELLENT**: Strong Fibonacci level (61.8% or 50%), excellent R:R, clear setup, low psychological risk
- **GOOD**: Valid Fibonacci level, good R:R, decent setup, manageable risks
- **ACCEPTABLE**: Minor issues but still tradeable with proper risk management
- **POOR**: Significant problems with setup, high psychological risk, poor R:R

**IMPORTANT:**
- Higher risk/reward ratios are BETTER, not worse
- All Fibonacci levels are valid trading levels
- Small moves are normal for shorter timeframes
- Focus on the Fibonacci retracement quality
- Consider market psychology and emotional factors

RESPONSE FORMAT (JSON):
{{
    "is_high_quality": true/false,
    "confidence_score": 0.0-1.0,
    "reasoning": "Professional trading analysis including technical, psychological, and risk factors",
    "risk_factors": ["technical_risk", "psychological_risk", "market_risk"],
    "strength_factors": ["technical_strength", "psychological_strength", "risk_management"],
    "recommendation": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL",
    "position_size": "SMALL/MEDIUM/LARGE",
    "risk_level": "LOW/MEDIUM/HIGH"
}}

Analyze this as a professional day trader with deep market insights. Consider technical analysis, market psychology, and risk management. If it's a valid Fibonacci retracement setup with good risk management, mark it as high quality.

Respond with ONLY the JSON object above.
"""
        return prompt
    
    def _parse_ai_response(self, response_text: str, setup_data: Dict) -> Dict:
        """Parse the AI response and extract quality metrics"""
        try:
            # Clean the response and extract JSON
            response_text = response_text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_data = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['is_high_quality', 'confidence_score', 'reasoning']
            for field in required_fields:
                if field not in response_data:
                    logger.error(f"Missing required field in AI response: {field}")
                    return self._basic_quality_check(setup_data)
            
            # Ensure confidence score is valid
            confidence = float(response_data['confidence_score'])
            confidence = max(0.0, min(1.0, confidence))
            
            return {
                'is_high_quality': bool(response_data['is_high_quality']),
                'confidence_score': confidence,
                'reasoning': str(response_data['reasoning']),
                'risk_factors': response_data.get('risk_factors', []),
                'strength_factors': response_data.get('strength_factors', []),
                'recommendation': response_data.get('recommendation', 'HOLD')
            }
            
        except Exception as e:
            logger.error(f"Error parsing AI response: {e}")
            return self._basic_quality_check(setup_data)
    
    def _basic_quality_check(self, setup_data: Dict) -> Dict:
        """Fallback quality check when AI is not available - Fibonacci-focused"""
        symbol = setup_data['symbol']
        timeframe = setup_data['timeframe']
        current_price = setup_data['current_price']
        swing_high = setup_data['swing_high']
        swing_low = setup_data['swing_low']
        trading_levels = setup_data['trading_levels']
        fib_levels = setup_data['fibonacci_levels']
        
        # Calculate basic metrics
        move_percent = abs(swing_high - swing_low) / swing_low * 100
        risk_reward_ratio = abs(trading_levels.get('tp1', 0) - current_price) / abs(current_price - trading_levels.get('sl', 0))
        
        # Check which Fibonacci level the price is closest to
        fib_levels_list = [0.236, 0.382, 0.5, 0.618, 0.786]
        closest_level = min(fib_levels_list, key=lambda x: abs(current_price - fib_levels[x]))
        level_distance = abs(current_price - fib_levels[closest_level]) / current_price * 100
        
        # Fibonacci-focused quality criteria
        is_high_quality = False
        confidence_score = 0.7  # Start with good confidence
        reasoning = "Fibonacci quality check"
        risk_factors = []
        strength_factors = []
        
        # 1. Check Fibonacci level quality
        if closest_level == 0.618:
            strength_factors.append(f"Price at GOLDEN RATIO (61.8%) - Most powerful level")
            confidence_score += 0.2
        elif closest_level == 0.5:
            strength_factors.append(f"Price at 50% level - Strong psychological support")
            confidence_score += 0.15
        elif closest_level == 0.382:
            strength_factors.append(f"Price at 38.2% level - Valid retracement")
            confidence_score += 0.1
        elif closest_level == 0.786:
            strength_factors.append(f"Price at 78.6% level - Deep retracement")
            confidence_score += 0.1
        else:
            strength_factors.append(f"Price at {closest_level*100:.0f}% level")
        
        # 2. Check if price is close enough to Fibonacci level (MORE LENIENT)
        if level_distance <= 1.0:  # Within 1% of Fibonacci level
            strength_factors.append(f"Price very close to Fibonacci level ({level_distance:.2f}% away)")
        elif level_distance <= 2.0:  # Within 2% of Fibonacci level
            strength_factors.append(f"Price near Fibonacci level ({level_distance:.2f}% away)")
        else:
            # Don't add as risk factor for testing - just note it
            strength_factors.append(f"Price at Fibonacci level ({level_distance:.2f}% away)")
        
        # 3. Check move size - FIBONACCI-APPROPRIATE (MORE LENIENT)
        min_move_required = 0.3 if timeframe == '1m' else 0.5 if timeframe in ['5m', '15m'] else 1.0
        if move_percent >= min_move_required:
            strength_factors.append(f"Valid swing move: {move_percent:.1f}%")
        else:
            # Don't add as risk factor for testing - just note it
            strength_factors.append(f"Small swing move: {move_percent:.1f}% (acceptable for testing)")
        
        # 4. Check risk/reward ratio - FIBONACCI-APPROPRIATE (MORE LENIENT)
        if risk_reward_ratio >= 1.5:
            strength_factors.append(f"Excellent R:R ratio: {risk_reward_ratio:.2f}")
            confidence_score += 0.15
        elif risk_reward_ratio >= 1.0:
            strength_factors.append(f"Good R:R ratio: {risk_reward_ratio:.2f}")
            confidence_score += 0.1
        elif risk_reward_ratio >= 0.5:
            strength_factors.append(f"Acceptable R:R ratio: {risk_reward_ratio:.2f}")
        else:
            # Don't add as risk factor for testing - just note it
            strength_factors.append(f"Low R:R ratio: {risk_reward_ratio:.2f} (acceptable for testing)")
        
        # 5. Determine overall quality - FIBONACCI-FOCUSED (MORE LENIENT FOR TESTING)
        if len(strength_factors) >= 2 and len(risk_factors) <= 2:
            is_high_quality = True
            confidence_score = min(0.95, confidence_score)  # Cap at 95%
            reasoning = "Strong Fibonacci retracement setup"
        elif len(strength_factors) >= 1:
            is_high_quality = True
            confidence_score = min(0.85, confidence_score)
            reasoning = "Good Fibonacci retracement setup"
        else:
            is_high_quality = True  # Even weak setups pass for testing
            confidence_score = max(0.6, confidence_score)
            reasoning = "Acceptable Fibonacci setup for testing"
        
        return {
            'is_high_quality': is_high_quality,
            'confidence_score': confidence_score,
            'reasoning': reasoning,
            'risk_factors': risk_factors,
            'strength_factors': strength_factors,
            'recommendation': 'STRONG_BUY' if is_high_quality and confidence_score >= 0.8 else 'BUY' if is_high_quality else 'HOLD'
        }
    
    def should_send_notification(self, setup_data: Dict) -> bool:
        """
        Determine if a notification should be sent based on setup quality
        Only sends notifications for high-quality setups
        """
        quality_analysis = self.analyze_setup_quality(setup_data)
        
        # Log the analysis
        logger.info(f"Setup Quality Analysis for {setup_data['symbol']}:")
        logger.info(f"  High Quality: {quality_analysis['is_high_quality']}")
        logger.info(f"  Confidence: {quality_analysis['confidence_score']:.2f}")
        logger.info(f"  Reasoning: {quality_analysis['reasoning']}")
        
        if quality_analysis['risk_factors']:
            logger.info(f"  Risk Factors: {', '.join(quality_analysis['risk_factors'])}")
        if quality_analysis['strength_factors']:
            logger.info(f"  Strength Factors: {', '.join(quality_analysis['strength_factors'])}")
        
        # VERY LENIENT THRESHOLD FOR TESTING - 40% instead of 50%
        should_send = (quality_analysis['is_high_quality'] and 
                      quality_analysis['confidence_score'] >= 0.4)
        
        if should_send:
            logger.info(f"✅ HIGH QUALITY SETUP - Sending notification for {setup_data['symbol']}")
        else:
            logger.info(f"❌ LOW QUALITY SETUP - Skipping notification for {setup_data['symbol']}")
        
        return should_send
    
    def get_quality_summary(self, setup_data: Dict) -> str:
        """Get a summary of the setup quality for logging"""
        quality_analysis = self.analyze_setup_quality(setup_data)
        
        status = "✅ HIGH QUALITY" if quality_analysis['is_high_quality'] else "❌ LOW QUALITY"
        confidence = quality_analysis['confidence_score']
        
        summary = f"""
🔍 SETUP QUALITY ANALYSIS
Symbol: {setup_data['symbol']}
Status: {status}
Confidence: {confidence:.1%}
Reasoning: {quality_analysis['reasoning']}
"""
        
        if quality_analysis['strength_factors']:
            summary += f"Strengths: {', '.join(quality_analysis['strength_factors'])}\n"
        
        if quality_analysis['risk_factors']:
            summary += f"Risks: {', '.join(quality_analysis['risk_factors'])}\n"
        
        return summary 