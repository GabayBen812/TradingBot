# 🤖 Gemini AI Quality Filter

## Overview

The Gemini AI Quality Filter is an advanced feature that uses Google's Gemini LLM to analyze Fibonacci trading setups and only send notifications for high-quality setups. This significantly reduces noise and improves the overall quality of trading signals.

## Features

- **AI-Powered Analysis**: Uses Gemini 1.5 Flash to analyze setup quality
- **Quality Scoring**: Provides confidence scores (0-100%) for each setup
- **Risk Assessment**: Identifies risk factors and strength factors
- **Smart Filtering**: Only sends notifications for setups with 70%+ confidence
- **Fallback Mode**: Works without API key using basic quality checks
- **Detailed Analysis**: Provides reasoning and recommendations

## Setup

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### 2. Configure Environment

Add your Gemini API key to your `.env` file:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies

```bash
pip install google-generativeai
```

## How It Works

### Quality Analysis Criteria

The AI analyzes setups based on:

1. **Fibonacci Level Quality**: Is the price at a strong Fibonacci level (61.8%, 50%, 38.2%)?
2. **Move Size**: Is the swing move significant enough (2%+ for 5m, 5%+ for higher timeframes)?
3. **Risk/Reward**: Is the risk/reward ratio favorable (ideally 1:2 or better)?
4. **Market Context**: Considers overall market trend and volatility
5. **Setup Clarity**: Is this a clear, clean setup or is there noise/confusion?

### Notification Filtering

- **High Quality**: Only setups with 70%+ confidence are sent
- **AI Analysis**: Each notification includes AI reasoning and recommendations
- **Quality Badge**: Visual indicators (🟢 EXCELLENT, 🟡 GOOD, 🟠 FAIR)
- **Risk/Strength Factors**: Detailed breakdown of setup characteristics

## Usage

### Automatic Integration

The filter is automatically integrated into the Discord notifier. When a Fibonacci setup is detected:

1. The setup data is sent to Gemini for analysis
2. AI determines if it's high quality (70%+ confidence)
3. Only high-quality setups trigger Discord notifications
4. Notifications include detailed AI analysis

### Manual Testing

Test the filter manually:

```bash
cd fibonacci_monitors
python test_gemini_filter.py
```

### Quality Analysis

Get detailed quality analysis for any setup:

```python
from gemini_filter import GeminiSetupFilter

filter = GeminiSetupFilter()
quality = filter.analyze_setup_quality(setup_data)
print(f"High Quality: {quality['is_high_quality']}")
print(f"Confidence: {quality['confidence_score']:.1%}")
print(f"Reasoning: {quality['reasoning']}")
```

## Configuration

### Quality Thresholds

You can adjust the quality thresholds in `gemini_filter.py`:

```python
# Only send notifications for high-quality setups with good confidence
should_send = (quality_analysis['is_high_quality'] and 
              quality_analysis['confidence_score'] >= 0.7)  # 70% threshold
```

### Analysis Criteria

Modify the analysis criteria in the `_create_analysis_prompt` method:

```python
ANALYSIS CRITERIA:
1. Fibonacci Level Quality
2. Move Size (2%+ for 5m, 5%+ for higher timeframes)
3. Risk/Reward (1:2 or better)
4. Market Context
5. Setup Clarity
```

## Fallback Mode

If no Gemini API key is provided, the system falls back to basic quality checks:

- **Move Size**: Minimum 2% for 5m/15m, 5% for higher timeframes
- **Risk/Reward**: Minimum 1.5:1 ratio
- **Basic Scoring**: Simple pass/fail based on criteria

## Benefits

### Reduced Noise
- Filters out low-quality setups automatically
- Only sends notifications for exceptional setups
- Reduces notification fatigue

### Improved Quality
- AI-powered analysis of setup characteristics
- Detailed reasoning for each decision
- Risk and strength factor identification

### Better Trading Results
- Higher win rate due to quality filtering
- Reduced false signals
- More actionable trading opportunities

## Example Output

### High Quality Setup
```
🚨 AI-VERIFIED HIGH QUALITY FIBONACCI SETUP 🚨

Symbol: BTCUSDT
Timeframe: 5m
Setup Type: SHORT
Current Price: $114151.68
Quality: 🟢 EXCELLENT (92%)

🤖 AI Analysis:
• Reasoning: Strong 61.8% retracement with excellent R:R ratio
• Recommendation: STRONG_SELL

✅ Strengths:
• Significant move: 1.30%
• Good R:R ratio: 2.15
• Clean Fibonacci level

Notification: ✅ SEND
```

### Low Quality Setup
```
❌ LOW QUALITY SETUP - Skipping notification for DOTUSDT

Status: ❌ LOW QUALITY
Confidence: 35%
Reasoning: Small move size and poor risk/reward ratio
Risks: Small move: 1.2%, Poor R:R ratio: 0.8

Notification: ❌ SKIP
```

## Troubleshooting

### API Key Issues
- Ensure `GEMINI_API_KEY` is set in your `.env` file
- Verify the API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)
- Check API quota and billing status

### No Notifications
- Check if setups are being filtered out by quality checks
- Review logs for "Setup filtered out by quality check" messages
- Adjust quality thresholds if needed

### Performance Issues
- The AI analysis adds ~1-2 seconds to setup detection
- Consider adjusting confidence thresholds for faster processing
- Monitor API usage and costs

## Cost Considerations

- Gemini API has usage-based pricing
- Typical cost: ~$0.01-0.05 per setup analysis
- Monitor usage in Google AI Studio dashboard
- Consider setting up billing alerts

## Advanced Configuration

### Custom Analysis Criteria

Modify the analysis prompt in `gemini_filter.py`:

```python
ANALYSIS CRITERIA:
1. **Fibonacci Level Quality**: Is the price at a strong Fibonacci level?
2. **Move Size**: Is the swing move significant enough?
3. **Risk/Reward**: Is the risk/reward ratio favorable?
4. **Market Context**: Consider the overall market trend
5. **Setup Clarity**: Is this a clear, clean setup?
6. **Volume Analysis**: Is there sufficient volume?
7. **Trend Alignment**: Does this align with higher timeframe trend?
```

### Quality Thresholds

Adjust the quality thresholds:

```python
# More strict filtering (only 90%+ confidence)
should_send = (quality_analysis['is_high_quality'] and 
              quality_analysis['confidence_score'] >= 0.9)

# Less strict filtering (60%+ confidence)
should_send = (quality_analysis['is_high_quality'] and 
              quality_analysis['confidence_score'] >= 0.6)
```

## Integration with Existing Monitors

The Gemini filter is automatically integrated with:

- **Enhanced Mega Monitor**: All monitors use quality filtering
- **Standard Monitor**: Individual symbol monitoring
- **Strategy Monitor**: Strategy-based setups
- **Position Manager**: Quality-checked position entries

## Monitoring and Logs

Check the logs for quality analysis:

```bash
tail -f fibonacci_bot.log | grep "Setup Quality Analysis"
```

Example log output:
```
2025-08-05 16:30:17 - INFO - Setup Quality Analysis for BTCUSDT:
2025-08-05 16:30:17 - INFO -   High Quality: True
2025-08-05 16:30:17 - INFO -   Confidence: 0.92
2025-08-05 16:30:17 - INFO -   Reasoning: Strong 61.8% retracement with excellent R:R ratio
2025-08-05 16:30:17 - INFO -   Strength Factors: Significant move: 1.30%, Good R:R ratio: 2.15
2025-08-05 16:30:17 - INFO - ✅ HIGH QUALITY SETUP - Sending notification for BTCUSDT
```

## Support

For issues with the Gemini filter:

1. Check the logs for error messages
2. Verify API key configuration
3. Test with `test_gemini_filter.py`
4. Review quality analysis criteria
5. Adjust thresholds if needed

The Gemini filter significantly improves the quality of your trading signals by leveraging AI to identify only the highest-quality Fibonacci setups! 