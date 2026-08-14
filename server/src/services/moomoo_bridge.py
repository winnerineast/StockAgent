import sys
import json
import argparse

# Force UTF-8 encoding for Windows stdout
sys.stdout.reconfigure(encoding='utf-8')

def output_json(obj):
    print("__JSON_START__" + json.dumps(obj, ensure_ascii=False) + "__JSON_END__")

def parse_args():
    parser = argparse.ArgumentParser(description="MooMoo OpenD Python Bridge")
    parser.add_argument("--action", type=str, default="portfolio", choices=["portfolio", "watchlist", "snapshots", "capital_flow", "market_universe", "full_scan"])
    parser.add_argument("--symbols", type=str, default="")
    return parser.parse_args()

def run_portfolio():
    from moomoo import OpenSecTradeContext, OpenQuoteContext, TrdEnv, TrdMarket, SecurityFirm
    ctx = OpenSecTradeContext(host='127.0.0.1', port=11111, filter_trdmarket=TrdMarket.US, security_firm=SecurityFirm.FUTUSG)

    ret_pos, pos_df = ctx.position_list_query(trd_env=TrdEnv.REAL, refresh_cache=True)
    ret_funds, funds_df = ctx.accinfo_query(trd_env=TrdEnv.REAL, refresh_cache=True)
    ctx.close()

    code_list = []
    if ret_pos == 0 and not pos_df.empty:
        code_list = [str(r.get('code', '')) for _, r in pos_df.iterrows() if r.get('code')]

    quotes_map = {}
    if code_list:
        try:
            qot_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
            ret_qot, qot_df = qot_ctx.get_stock_quote(code_list)
            if ret_qot == 0 and not qot_df.empty:
                for _, qr in qot_df.iterrows():
                    sym = str(qr.get('code', '')).replace('US.', '').replace('HK.', '')
                    lp = float(qr.get('last_price', 0) or qr.get('last_close_price', 0) or 0)
                    if lp > 0:
                        quotes_map[sym] = lp
            qot_ctx.close()
        except Exception:
            pass

    positions = []
    if ret_pos == 0 and not pos_df.empty:
        for _, r in pos_df.iterrows():
            raw_code = str(r.get('code', ''))
            symbol = raw_code.replace('US.', '').replace('HK.', '')
            cost_p = float(r.get('cost_price', 0) or r.get('average_cost', 0))
            nom_p = float(r.get('nominal_price', 0) or 0)
            real_m_price = quotes_map.get(symbol) or nom_p or cost_p

            positions.append({
                'symbol': symbol,
                'companyName': str(r.get('stock_name', symbol)),
                'shares': float(r.get('qty', 0)),
                'costBasis': cost_p,
                'marketPrice': real_m_price
            })

    cash = 0.0
    if ret_funds == 0 and not funds_df.empty:
        r = funds_df.iloc[0]
        cash = float(r.get('us_cash', 0) or r.get('cash', 0) or 0.0)

    output_json({
        'success': True,
        'detectedCash': cash,
        'positions': positions
    })

def run_watchlist():
    from moomoo import OpenQuoteContext
    ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    ret, df = ctx.get_user_security('全部')
    ctx.close()

    watchlist = []
    if ret == 0 and not df.empty:
        for _, r in df.iterrows():
            raw_code = str(r.get('code', ''))
            sym = raw_code.replace('US.', '').replace('HK.', '').strip()
            name = str(r.get('name', sym)).strip()
            if sym:
                watchlist.append({
                    'symbol': sym,
                    'companyName': name or sym
                })

    output_json({
        'success': True,
        'watchlist': watchlist
    })

def run_snapshots(symbols_str: str):
    from moomoo import OpenQuoteContext
    raw_symbols = [s.strip().upper() for s in symbols_str.split(',') if s.strip()]
    if not raw_symbols:
        output_json({'success': True, 'snapshots': []})
        return

    codes = [f"US.{s}" if not s.startswith("US.") and not s.startswith("HK.") else s for s in raw_symbols]
    ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    ret, df = ctx.get_market_snapshot(codes)
    ctx.close()

    snapshots = []
    if ret == 0 and not df.empty:
        for _, r in df.iterrows():
            sym = str(r.get('code', '')).replace('US.', '').replace('HK.', '')
            last_p = float(r.get('last_price', 0) or r.get('prev_close_price', 0) or 0)
            high_52w = float(r.get('highest52weeks_price', 0) or 0)
            low_52w = float(r.get('lowest52weeks_price', 0) or 0)
            pe = float(r.get('pe_ratio', 0) or 0)
            pe_ttm = float(r.get('pe_ttm_ratio', 0) or 0)
            pb = float(r.get('pb_ratio', 0) or 0)
            turnover = float(r.get('turnover_rate', 0) or 0)
            pre_change = float(r.get('pre_change_rate', 0) or 0)
            after_change = float(r.get('after_change_rate', 0) or 0)
            eps = float(r.get('earning_per_share', 0) or 0)
            net_profit = float(r.get('net_profit', 0) or 0)
            total_market_val = float(r.get('total_market_val', 0) or 0)

            snapshots.append({
                'symbol': sym,
                'name': str(r.get('name', sym)),
                'lastPrice': last_p,
                'openPrice': float(r.get('open_price', 0) or 0),
                'highPrice': float(r.get('high_price', 0) or 0),
                'lowPrice': float(r.get('low_price', 0) or 0),
                'prevClosePrice': float(r.get('prev_close_price', 0) or 0),
                'highest52WeeksPrice': high_52w,
                'lowest52WeeksPrice': low_52w,
                'peRatio': pe,
                'peTtmRatio': pe_ttm,
                'pbRatio': pb,
                'netProfit': net_profit,
                'earningPerShare': eps,
                'totalMarketVal': total_market_val,
                'turnoverRate': turnover,
                'prePrice': float(r.get('pre_price', 0) or 0),
                'preChangeRate': pre_change,
                'afterPrice': float(r.get('after_price', 0) or 0),
                'afterChangeRate': after_change,
            })

    output_json({
        'success': True,
        'snapshots': snapshots
    })

def run_capital_flow(symbols_str: str):
    from moomoo import OpenQuoteContext
    raw_symbols = [s.strip().upper() for s in symbols_str.split(',') if s.strip()]
    if not raw_symbols:
        output_json({'success': True, 'flows': {}})
        return

    ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    flows = {}
    for s in raw_symbols[:10]: # limit to top 10
        code = f"US.{s}" if not s.startswith("US.") and not s.startswith("HK.") else s
        try:
            ret, df = ctx.get_capital_flow(code)
            if ret == 0 and not df.empty:
                last_row = df.iloc[-1]
                in_flow = float(last_row.get('in_flow', 0) or 0)
                main_in_flow = float(last_row.get('main_in_flow', 0) if 'main_in_flow' in last_row and str(last_row.get('main_in_flow')) != 'N/A' else in_flow)
                flows[s] = {
                    'inFlow': in_flow,
                    'mainInFlow': main_in_flow,
                    'trend': 'INFLOW' if in_flow > 0 else 'OUTFLOW' if in_flow < 0 else 'NEUTRAL'
                }
        except Exception:
            pass
    ctx.close()
    output_json({
        'success': True,
        'flows': flows
    })

def run_market_universe():
    from moomoo import OpenQuoteContext, Market, SecurityType, Plate
    ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
    
    universe = {}

    # 1. 从 OpenD 官方自选股同步 (最高优先级)
    try:
        ret_w, df_w = ctx.get_user_security('全部')
        if ret_w == 0 and not df_w.empty:
            for _, r in df_w.iterrows():
                raw_code = str(r.get('code', ''))
                sym = raw_code.replace('US.', '').replace('HK.', '').strip().upper()
                if sym and sym.isalpha() and 1 <= len(sym) <= 5:
                    name = str(r.get('name', sym)).strip()
                    universe[sym] = name or sym
    except Exception:
        pass

    # 2. 从 OpenD 全部 349 个官方行业核心板块动态拉取全部活跃股票
    try:
        ret_p, df_p = ctx.get_plate_list(Market.US, Plate.ALL)
        if ret_p == 0 and not df_p.empty:
            for _, pr in df_p.iterrows():
                p_code = pr.get('code')
                try:
                    r, df_s = ctx.get_plate_stock(p_code)
                    if r == 0 and not df_s.empty:
                        for _, row in df_s.iterrows():
                            code = str(row.get('code', '')).replace('US.', '').strip().upper()
                            name = str(row.get('stock_name', code)).strip()
                            if code and code.isalpha() and 1 <= len(code) <= 5:
                                if code not in universe:
                                    universe[code] = name or code
                except Exception:
                    pass
    except Exception:
        pass

    # 3. 从 OpenD 官方全市场美股档案补充 (严格过滤期货、期权、外汇)
    try:
        ret, df = ctx.get_stock_basicinfo(market=Market.US, stock_type=SecurityType.STOCK)
        if ret == 0 and not df.empty:
            for _, r in df.iterrows():
                code = str(r.get('code', ''))
                delisted = str(r.get('delisting', '')).lower()
                if delisted in ['true', 'delisting', 'delisted']:
                    continue
                if code.startswith('US.'):
                    sym = code[3:].strip().upper()
                    if sym.isalpha() and 1 <= len(sym) <= 5:
                        if sym not in universe:
                            name = str(r.get('name', sym)).strip()
                            universe[sym] = name or sym
    except Exception:
        pass

    ctx.close()

    universe_list = [{'symbol': s, 'companyName': n} for s, n in universe.items()]
    output_json({
        'success': True,
        'totalCount': len(universe_list),
        'universe': universe_list
    })

if __name__ == "__main__":
    try:
        args = parse_args()
        if args.action == "portfolio":
            run_portfolio()
        elif args.action == "watchlist":
            run_watchlist()
        elif args.action == "snapshots":
            run_snapshots(args.symbols)
        elif args.action == "capital_flow":
            run_capital_flow(args.symbols)
        elif args.action == "market_universe":
            run_market_universe()
        else:
            run_portfolio()
    except Exception as e:
        output_json({
            'success': False,
            'error': str(e)
        })
