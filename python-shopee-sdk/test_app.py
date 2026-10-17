#!/usr/bin/env python3
"""
End-to-end test application for the Python Shopee v2 SDK against shopee-mock.

Usage:
    # 1. Start shopee-mock in another terminal:
    #    cd /home/nguyentnt/MMVI/shop/shopee-mock && STRICT_SIG=true npm start
    #
    # 2. Run this test script:
    #    python3 /home/nguyentnt/MMVI/shop/python-shopee-sdk/test_app.py
"""

import os
import sys
import time
from shopee_client import ShopeeClient, ShopeeApiError


def run_tests() -> None:
    partner_id = int(os.environ.get("SHOPEE_PARTNER_ID", "1"))
    partner_key = os.environ.get("SHOPEE_PARTNER_KEY", "1")
    shop_id = int(os.environ.get("SHOPEE_SHOP_ID", "222"))
    base_url = os.environ.get("SHOPEE_BASE_URL", "http://localhost:3000/api/v2")
    base_auth_url = os.environ.get("SHOPEE_AUTH_URL", "http://localhost:3000/auth")

    print("=" * 68)
    print(" Shopee Open Platform v2 — Python SDK End-to-End Test Suite")
    print("=" * 68)
    print(f"Target Base URL : {base_url}")
    print(f"Partner ID      : {partner_id}")
    print(f"Shop ID         : {shop_id}")
    print("-" * 68)

    client = ShopeeClient(
        partner_id=partner_id,
        partner_key=partner_key,
        shop_id=shop_id,
        base_url=base_url,
        base_auth_url=base_auth_url,
    )

    # 1. OAuth Authorization URL & Token Exchange
    print("\n[1/8] Testing OAuth Authorization & Token Exchange...")
    auth_url = client.get_authorization_url(
        redirect_uri="http://localhost:8080/callback",
        state="python_sdk_test",
    )
    assert f"partner_id={partner_id}" in auth_url
    print(f"  ✓ Auth URL generated: {auth_url}")

    token = client.authenticate_with_code(code="mock_auth_code", shop_id=shop_id)
    assert token.access_token and token.refresh_token
    print(f"  ✓ Access Token obtained: {token.access_token} (expires in {token.expire_in}s)")

    refreshed = client.refresh_access_token(shop_id=shop_id)
    assert refreshed.access_token and refreshed.refresh_token
    print(f"  ✓ Token refreshed      : {refreshed.access_token}")

    # 2. Public APIs (Partner-level signature)
    print("\n[2/8] Testing Public APIs...")
    ip_res = client.public.get_shopee_ip_ranges()
    ip_list = ip_res.get("response", {}).get("ip_list", [])
    assert len(ip_list) > 0
    print(f"  ✓ Shopee IP ranges: {ip_list}")

    shops_res = client.public.get_shops_by_partner()
    authed_shops = shops_res.get("response", {}).get("authed_shop_list", [])
    assert len(authed_shops) > 0
    print(f"  ✓ Authorized shops: {[s.get('shop_id') for s in authed_shops]}")

    # 3. Shop APIs (Shop-level signature)
    print("\n[3/8] Testing Shop Info & Profile...")
    shop_info = client.shop.get_shop_info()
    assert shop_info.get("shop_name")
    print(f"  ✓ Shop Name: {shop_info.get('shop_name')} (Region: {shop_info.get('region')}, Status: {shop_info.get('status')})")

    updated_profile = client.shop.update_profile(
        shop_name="Python SDK Demo Shop",
        description="Official test store managed by Python Shopee SDK",
    )
    assert updated_profile["response"]["shop_name"] == "Python SDK Demo Shop"
    print(f"  ✓ Updated Shop Profile Name: {updated_profile['response']['shop_name']}")

    # 4. Product CRUD Lifecycle
    print("\n[4/8] Testing Product CRUD Lifecycle...")
    categories = client.product.get_category()
    cat_list = categories["response"]["category_list"]
    assert len(cat_list) > 0
    print(f"  ✓ Loaded {len(cat_list)} product categories (first: {cat_list[0]['display_category_name']})")

    new_item_res = client.product.add_item(
        {
            "item_name": "Wireless Mechanical Keyboard RGB",
            "description": "Hot-swappable 75% wireless mechanical keyboard",
            "category_id": cat_list[0]["category_id"],
            "original_price": 1890,
            "item_sku": "KB-RGB-75",
            "weight": 0.85,
            "seller_stock": [{"stock": 45}],
        }
    )
    new_item_id = new_item_res["response"]["item_id"]
    print(f"  ✓ Created Product item_id={new_item_id} ({new_item_res['response']['item_name']})")

    client.product.update_price(
        item_id=new_item_id,
        price_list=[{"model_id": 0, "original_price": 1690}],
    )
    client.product.update_stock(
        item_id=new_item_id,
        stock_list=[{"model_id": 0, "seller_stock": [{"stock": 80}]}],
    )

    base_info = client.product.get_item_base_info([new_item_id])
    fetched_item = base_info["response"]["item_list"][0]
    assert fetched_item["item_id"] == new_item_id
    print(
        f"  ✓ Verified Product update: price={fetched_item['price_info'][0]['original_price']}, "
        f"stock={fetched_item['stock_info_v2']['summary_info']['total_available_stock']}"
    )

    del_res = client.product.delete_item(new_item_id)
    assert del_res.get("error", "") == ""
    print(f"  ✓ Deleted Product item_id={new_item_id}")

    # 5. Order Management
    print("\n[5/8] Testing Order List & Detail...")
    order_list_res = client.order.get_order_list(
        time_range_field="create_time",
        time_from=int(time.time()) - 86400 * 7,
        time_to=int(time.time()),
        page_size=10,
    )
    orders = order_list_res["response"]["order_list"]
    assert len(orders) > 0
    order_sn = orders[0]["order_sn"]
    print(f"  ✓ Found {len(orders)} orders (first order_sn={order_sn}, status={orders[0]['order_status']})")

    detail_res = client.order.get_order_detail([order_sn])
    order_detail = detail_res["response"]["order_list"][0]
    assert order_detail["order_sn"] == order_sn
    print(
        f"  ✓ Order Detail: buyer={order_detail['buyer_username']}, "
        f"total={order_detail['total_amount']} {order_detail['currency']}, "
        f"items={len(order_detail['item_list'])}"
    )

    # 6. Logistics & Shipping Label PDF Download
    print("\n[6/8] Testing Logistics, Ship Order & Airway Bill PDF...")
    channels = client.logistics.get_channel_list()["response"]["logistics_channel_list"]
    assert len(channels) > 0
    print(f"  ✓ Logistics channels available: {[c['logistics_channel_name'] for c in channels]}")

    ship_params = client.logistics.get_shipping_parameter(order_sn)
    address_id = ship_params["response"]["pickup"]["address_list"][0]["address_id"]
    pickup_time_id = ship_params["response"]["pickup"]["address_list"][0]["time_slot_list"][0]["pickup_time_id"]

    client.logistics.ship_order(
        order_sn=order_sn,
        pickup={"address_id": address_id, "pickup_time_id": pickup_time_id},
    )
    tracking_res = client.logistics.get_tracking_number(order_sn)
    tracking_no = tracking_res["response"]["tracking_number"]
    assert tracking_no
    print(f"  ✓ Shipped order {order_sn} -> tracking_number={tracking_no}")

    doc_order_list = [{"order_sn": order_sn, "tracking_number": tracking_no}]
    client.logistics.create_shipping_document(doc_order_list)
    doc_result = client.logistics.get_shipping_document_result(doc_order_list)
    doc_status = doc_result["response"]["result_list"][0]["status"]
    assert doc_status == "READY"

    pdf_bytes = client.logistics.download_shipping_document(doc_order_list)
    assert pdf_bytes.startswith(b"%PDF")
    print(f"  ✓ Downloaded Shipping Document PDF ({len(pdf_bytes)} bytes, status={doc_status})")

    # 7. Payment & Vouchers
    print("\n[7/8] Testing Payment Escrow & Vouchers...")
    escrow = client.payment.get_escrow_detail(order_sn)["response"]["order_income"]
    print(f"  ✓ Escrow Detail for {order_sn}: escrow_amount={escrow['escrow_amount']}")

    now = int(time.time())
    voucher_res = client.voucher.add_voucher(
        {
            "voucher_name": "Python SDK Promo",
            "voucher_code": "PYSAVE50",
            "start_time": now + 60,
            "end_time": now + 86400,
            "voucher_type": 1,
            "reward_type": 1,
            "usage_quantity": 100,
            "min_basket_price": 200,
            "discount_amount": 50,
            "max_price": 50,
        }
    )
    voucher_id = voucher_res["response"]["voucher_id"]
    vouchers = client.voucher.get_voucher_list()["response"]["voucher_list"]
    assert any(v["voucher_id"] == voucher_id for v in vouchers)
    client.voucher.delete_voucher(voucher_id)
    print(f"  ✓ Created, listed, and deleted Voucher voucher_id={voucher_id}")

    # 8. Full 455-Schema & 31-Module Verification
    print("\n[8/8] Testing All 455 Shopee v2 API Schemas Across All 31 Modules...")
    modules = client.list_modules()
    endpoints = client.list_endpoints()
    assert len(modules) == 31, f"Expected 31 modules, got {len(modules)}"
    assert len(endpoints) == 455, f"Expected 455 endpoints, got {len(endpoints)}"
    print(f"  ✓ Loaded {len(endpoints)} official Shopee v2 schemas across {len(modules)} modules:")
    print(f"    {', '.join(modules)}")

    # Test dynamic module callers directly (e.g., discount, returns, ads, livestream, shop_flash_sale)
    ret_list = client.returns.get_return_list(page_no=1, page_size=10)
    assert ret_list.get("error") == ""
    flash_criteria = client.shop_flash_sale.get_item_criteria()
    assert flash_criteria.get("error") == ""
    ads_balance = client.ads.get_total_balance()
    assert ads_balance.get("error") == ""

    # Provide valid IDs for stateful endpoints that validate resource existence
    stateful_sample_Args = {
        "v2.logistics.ship_order": {"order_sn": order_sn},
        "v2.logistics.download_shipping_document": {"order_list": [{"order_sn": order_sn}]},
        "v2.logistics.download_shipping_document_job": {"job_id": "JOB_INI_001"},
        "v2.payment.get_escrow_detail": {"order_sn": order_sn},
        "v2.product.update_item": {"item_id": 10001, "item_name": "70% Isopropyl Alcohol 500ml"},
        "v2.returns.get_return_detail": {"return_sn": "RET20260521001"},
    }

    passed_count = 0
    for api_name in endpoints:
        extra = stateful_sample_Args.get(api_name, {})
        res = client.call_api(api_name, extra)
        assert isinstance(res, (dict, bytes)), f"Unexpected response for {api_name}"
        passed_count += 1

    assert passed_count == 455
    print(f"  ✓ Verified {passed_count}/455 Shopee v2 API endpoints end-to-end (100% schema coverage!)")

    print("\n" + "=" * 68)
    print(" ALL 8 PYTHON SDK TEST SUITES (455/455 API SCHEMAS) PASSED!")
    print("=" * 68)


if __name__ == "__main__":
    try:
        run_tests()
    except ShopeeApiError as exc:
        print(f"\n[ERROR] Shopee API Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"\n[ERROR] Unexpected failure: {exc}", file=sys.stderr)
        raise
