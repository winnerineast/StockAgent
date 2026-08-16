import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

res = json.loads(urllib.request.urlopen('http://127.0.0.1:3001/api/stock/strategy/stage').read().decode('utf-8'))
data = res.get('data', {})
stageData = data.get('liveStageData', {})
perStockItems = stageData.get('perStockItems', [])
print('perStockItems count:', len(perStockItems))

for item in perStockItems:
    rec = item.get('currentRecommendation') or {}
    sym = item.get('symbol')
    label = item.get('strategyCategoryLabel')
    reason = item.get('strategyCategoryReason')
    action = rec.get('action')
    shares = rec.get('suggestedShares')
    print(f"[{sym}] 策略分类: {label} | 建议: {action} ({shares}股)")
    print(f"  分类理由: {reason}")
    print(f"  推演理由: {rec.get('rationale')}\n")
