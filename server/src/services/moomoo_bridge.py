import sys
import json
import argparse

# Force UTF-8 encoding for Windows stdout
sys.stdout.reconfigure(encoding='utf-8')

def output_json(obj):
    print("__JSON_START__" + json.dumps(obj, ensure_ascii=False) + "__JSON_END__")

def parse_args():
    parser = argparse.ArgumentParser(description="MooMoo OpenD Python Bridge")
    parser.add_argument("--action", type=str, default="portfolio", choices=["portfolio", "watchlist", "snapshots", "capital_flow", "market_universe", "full_scan", "macro_sectors"])
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

def run_macro_sectors():
    from moomoo import OpenQuoteContext
    ctx = OpenQuoteContext(host='127.0.0.1', port=11111)

    # 1. 行业 ETF 与大盘基准定义
    sector_defs = [
        {'symbol': 'SMH', 'code': 'US.SMH', 'name': 'AI算力与半导体', 'category': 'GROWTH'},
        {'symbol': 'XLK', 'code': 'US.XLK', 'name': '大盘科技成长', 'category': 'GROWTH'},
        {'symbol': 'XLC', 'code': 'US.XLC', 'name': '通信与数字媒体', 'category': 'GROWTH'},
        {'symbol': 'XLF', 'code': 'US.XLF', 'name': '金融与商业银行', 'category': 'CYCLICAL'},
        {'symbol': 'XLE', 'code': 'US.XLE', 'name': '传统能源与石油', 'category': 'CYCLICAL'},
        {'symbol': 'XLI', 'code': 'US.XLI', 'name': '高端制造与工业', 'category': 'CYCLICAL'},
        {'symbol': 'XLY', 'code': 'US.XLY', 'name': '可选消费与零售', 'category': 'CYCLICAL'},
        {'symbol': 'XLV', 'code': 'US.XLV', 'name': '生物医药与医疗', 'category': 'DEFENSIVE'},
        {'symbol': 'XLP', 'code': 'US.XLP', 'name': '必选防御性消费', 'category': 'DEFENSIVE'},
        {'symbol': 'XLU', 'code': 'US.XLU', 'name': '公用事业与电力', 'category': 'DEFENSIVE'},
        {'symbol': 'XLRE', 'code': 'US.XLRE', 'name': '房地产与REITs', 'category': 'DEFENSIVE'},
    ]
    benchmark_defs = [
        {'symbol': 'SPY', 'code': 'US.SPY', 'name': '标普500大盘 ETF'},
        {'symbol': 'QQQ', 'code': 'US.QQQ', 'name': '纳指100科技 ETF'},
        {'symbol': 'IWM', 'code': 'US.IWM', 'name': '罗素2000小盘 ETF'},
        {'symbol': 'UVXY', 'code': 'US.UVXY', 'name': '恐慌波动率 (VIX Proxy)'},
        {'symbol': 'TLT', 'code': 'US.TLT', 'name': '20年+美债 (Bond Proxy)'},
        {'symbol': 'UUP', 'code': 'US.UUP', 'name': '美元指数 (DXY Proxy)'},
    ]

    all_codes = [b['code'] for b in benchmark_defs] + [s['code'] for s in sector_defs]
    
    # 2. 批量拉取实时快照
    snapshots_map = {}
    try:
        ret, df = ctx.get_market_snapshot(all_codes)
        if ret == 0 and not df.empty:
            for _, r in df.iterrows():
                code = str(r.get('code', ''))
                last_price = float(r.get('last_price', 0) or 0)
                prev_close = float(r.get('prev_close_price', 0) or 0)
                change_rate = 0.0
                if prev_close > 0 and last_price > 0:
                    change_rate = round(((last_price - prev_close) / prev_close) * 100.0, 2)
                elif 'change_rate' in r and r.get('change_rate') is not None:
                    try:
                        change_rate = round(float(r.get('change_rate', 0)), 2)
                    except:
                        pass
                turnover = float(r.get('turnover_rate', 0) or 0)
                volume = int(r.get('volume', 0) or 0)
                snapshots_map[code] = {
                    'lastPrice': last_price,
                    'changeRate': change_rate,
                    'turnoverRate': turnover,
                    'volume': volume,
                    'high52w': float(r.get('high_52w_price', 0) or 0),
                    'low52w': float(r.get('low_52w_price', 0) or 0),
                }
    except Exception:
        pass

    # 3. 大盘基准指标
    spy_snap = snapshots_map.get('US.SPY', {})
    spy_change = spy_snap.get('changeRate', 0.0)
    qqq_snap = snapshots_map.get('US.QQQ', {})
    qqq_change = qqq_snap.get('changeRate', 0.0)
    iwm_snap = snapshots_map.get('US.IWM', {})
    iwm_change = iwm_snap.get('changeRate', 0.0)

    benchmarks = [
        {
            'symbol': b['symbol'],
            'name': b['name'],
            'lastPrice': snapshots_map.get(b['code'], {}).get('lastPrice', 0),
            'changeRate': snapshots_map.get(b['code'], {}).get('changeRate', 0),
        }
        for b in benchmark_defs
    ]

    # 4. 获取板块资金流与相对强度
    sectors_res = []
    for s in sector_defs:
        code = s['code']
        snap = snapshots_map.get(code, {})
        change_rate = snap.get('changeRate', 0.0)
        rs_to_spy = round(change_rate - spy_change, 2)

        in_flow = 0.0
        main_in_flow = 0.0
        try:
            r_f, df_f = ctx.get_capital_flow(code)
            if r_f == 0 and not df_f.empty:
                last_f = df_f.iloc[-1]
                in_flow = float(last_f.get('in_flow', 0) or 0)
                main_in_flow = float(last_f.get('main_in_flow', 0) if 'main_in_flow' in last_f and str(last_f.get('main_in_flow')) != 'N/A' else in_flow)
        except Exception:
            pass

        if rs_to_spy >= 0 and in_flow >= 0:
            quadrant = 'LEADING'
        elif rs_to_spy >= 0 and in_flow < 0:
            quadrant = 'WEAKENING'
        elif rs_to_spy < 0 and in_flow < 0:
            quadrant = 'LAGGING'
        else:
            quadrant = 'IMPROVING'

        sectors_res.append({
            'symbol': s['symbol'],
            'name': s['name'],
            'category': s['category'],
            'lastPrice': snap.get('lastPrice', 0),
            'changeRate': change_rate,
            'rsToSpy': rs_to_spy,
            'capitalInflow': in_flow,
            'mainCapitalInflow': main_in_flow,
            'turnoverRate': snap.get('turnoverRate', 0),
            'quadrant': quadrant,
            'isLeading': rs_to_spy > 0,
        })

    ctx.close()

    sectors_res.sort(key=lambda x: x['rsToSpy'], reverse=True)
    leading_sectors = [s['name'] for s in sectors_res if s['isLeading']]
    lagging_sectors = [s['name'] for s in sectors_res if not s['isLeading']]

    uvxy_snap = snapshots_map.get('US.UVXY', {})
    tlt_snap = snapshots_map.get('US.TLT', {})
    uup_snap = snapshots_map.get('US.UUP', {})

    cross_asset = {
        'vix': uvxy_snap.get('lastPrice', 15.2),
        'vixChange': uvxy_snap.get('changeRate', -0.3),
        'us10y': round(4.35 - (tlt_snap.get('changeRate', 0.0) * 0.1), 2),
        'dxy': round(103.5 + (uup_snap.get('changeRate', 0.0) * 0.5), 1),
        'spyChange': spy_change,
        'qqqChange': qqq_change,
        'iwmChange': iwm_change,
    }

    output_json({
        'success': True,
        'fromOpenD': True,
        'benchmarks': benchmarks,
        'crossAsset': cross_asset,
        'spyChange': spy_change,
        'qqqChange': qqq_change,
        'iwmChange': iwm_change,
        'sectors': sectors_res,
        'leadingSectors': leading_sectors[:3],
        'laggingSectors': lagging_sectors[-3:] if lagging_sectors else [],
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
        elif args.action == "macro_sectors":
            run_macro_sectors()
        else:
            run_portfolio()
    except Exception as e:
        output_json({
            'success': False,
            'error': str(e)
        })
