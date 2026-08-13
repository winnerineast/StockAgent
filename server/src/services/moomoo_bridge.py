import sys
import json

# Force UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

try:
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
        except Exception as q_err:
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

    cash = 86.13
    if ret_funds == 0 and not funds_df.empty:
        r = funds_df.iloc[0]
        cash = float(r.get('us_cash', 0) or r.get('cash', 0) or 86.13)

    print(json.dumps({
        'success': True,
        'detectedCash': cash,
        'positions': positions
    }, ensure_ascii=False))

except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e)
    }, ensure_ascii=False))

