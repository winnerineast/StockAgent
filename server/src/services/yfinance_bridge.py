import sys
import json
import argparse

def output_json(data):
    print("__JSON_START__")
    print(json.dumps(data, ensure_ascii=False))
    print("__JSON_END__")

def get_ticker_data(symbol):
    import yfinance as yf
    sym = symbol.strip().upper()
    ticker = yf.Ticker(sym)
    
    info = ticker.info or {}
    fast_info = getattr(ticker, 'fast_info', {})
    
    price = (
        info.get('currentPrice') or
        info.get('regularMarketPrice') or
        getattr(fast_info, 'last_price', None) or
        info.get('previousClose') or
        getattr(fast_info, 'previous_close', None) or
        0.0
    )
    
    prev_close = (
        info.get('previousClose') or
        info.get('regularMarketPreviousClose') or
        getattr(fast_info, 'previous_close', None) or
        price
    )
    
    change_rate = 0.0
    if prev_close and prev_close > 0 and price > 0:
        change_rate = round(((price - prev_close) / prev_close) * 100, 2)
        
    pe = (
        info.get('trailingPE') or
        info.get('forwardPE') or
        None
    )
    if pe is not None:
        try:
            pe = round(float(pe), 2)
        except (ValueError, TypeError):
            pe = None

    rev_growth = info.get('revenueGrowth')
    if rev_growth is not None:
        try:
            rev_growth = round(float(rev_growth) * 100, 2)
        except (ValueError, TypeError):
            rev_growth = None

    net_margin = info.get('profitMargins')
    if net_margin is not None:
        try:
            net_margin = round(float(net_margin) * 100, 2)
        except (ValueError, TypeError):
            net_margin = None

    debt_to_equity = info.get('debtToEquity')
    if debt_to_equity is not None:
        try:
            debt_to_equity = round(float(debt_to_equity), 2)
        except (ValueError, TypeError):
            debt_to_equity = None

    # Next earnings date timestamp
    earnings_date_str = None
    cal = getattr(ticker, 'calendar', None)
    if cal is not None and isinstance(cal, dict) and 'Earnings Date' in cal:
        dates = cal['Earnings Date']
        if dates and len(dates) > 0:
            earnings_date_str = str(dates[0]).split('T')[0]
    elif info.get('earningsTimestamp'):
        import datetime
        try:
            dt = datetime.datetime.fromtimestamp(info['earningsTimestamp'])
            earnings_date_str = dt.strftime('%Y-%m-%d')
        except Exception:
            pass

    return {
        "symbol": sym,
        "companyName": info.get('shortName') or info.get('longName') or sym,
        "price": float(price),
        "prevClose": float(prev_close),
        "changePercent": float(change_rate),
        "sector": info.get('sector') or "Technology",
        "industry": info.get('industry') or "",
        "peRatio": pe,
        "revenueGrowthPct": rev_growth,
        "netMarginPct": net_margin,
        "debtToEquity": debt_to_equity,
        "nextEarningsDate": earnings_date_str,
        "summary": (info.get('longBusinessSummary') or "")[:300],
        "dataSource": "YAHOO_FINANCE"
    }

def main():
    parser = argparse.ArgumentParser(description="Yahoo Finance Bridge for StockAgent")
    parser.add_argument("--symbols", type=str, help="Comma-separated symbols, e.g. AAPL,AMD,NVDA")
    parser.add_argument("--symbol", type=str, help="Single symbol, e.g. AAPL")
    args = parser.parse_args()

    symbols = []
    if args.symbols:
        symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    elif args.symbol:
        symbols = [args.symbol.strip().upper()]

    if not symbols:
        output_json({"success": False, "error": "No symbols specified"})
        return

    results = {}
    for sym in symbols:
        try:
            results[sym] = get_ticker_data(sym)
        except Exception as e:
            results[sym] = {
                "symbol": sym,
                "error": str(e),
                "dataSource": "YAHOO_FINANCE"
            }

    output_json({"success": True, "data": results})

if __name__ == "__main__":
    main()
