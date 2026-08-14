import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:3001/api/stock/strategy/generate"
data = json.dumps({"customBudget": 1500}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    print("🚀 Triggering full daily strategy deduction...")
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print("Success:", res.get("success"))
        data_obj = res.get("data", {})
        output = data_obj.get("output", {})
        actions = output.get("actions", [])
        per_stock = output.get("perStockDeductionRetro", [])
        print(f"\n📊 Total Screened Candidates: {len(per_stock)}")
        print(f"🎯 Total Actionable Recommendations: {len(actions)}")
        
        category_counts = {}
        for a in actions:
            cat = a.get("strategyCategoryLabel") or "未分类"
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
        print("\n📈 5大策略分类统计 (Strategy Category Distribution):")
        for cat, cnt in category_counts.items():
            print(f"  - {cat}: {cnt} 标的")
            
        print("\n📝 候选标的及精确定量指南 (Sample Actions):")
        for a in actions[:10]:
            print(f"  [{a.get('symbol')}] Action: {a.get('action')} ({a.get('suggestedShares')}股) | 现价: ${a.get('estimatedPrice')} | 目标价: ${a.get('targetPrice')} | 止损: ${a.get('stopLossPrice')}")
            print(f"    分类归属: {a.get('strategyCategoryLabel')}")
            print(f"    策略理由: {a.get('strategyCategoryReason') or a.get('rationale')}\n")
except Exception as e:
    print("Execution Error:", e)
