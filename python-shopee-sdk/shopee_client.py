"""
Clean, 100% Schema-Complete Python SDK for Shopee Open Platform API v2.
Compatible with shopee-mock & live Shopee Open Platform v2.

Features:
- Zero external dependencies (uses Python standard library: urllib, hmac, hashlib, json, pathlib)
- Full HMAC-SHA256 signature generation for Public, Shop, Merchant, User, and Principal APIs
- OAuth 2.0 authorization URL builder, code exchange, and automatic token refresh
- Explicit typed managers for core domains + dynamic bindings for ALL 455 official Shopee v2
  API schemas across all 31 modules (loaded from ../shopee-sdk/schemas).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union


class ShopeeApiError(Exception):
    """Raised when Shopee API returns an HTTP error or non-empty error code."""

    def __init__(self, status: int, error: str, message: str, data: Any = None):
        super().__init__(f"[{status}] {error}: {message}")
        self.status = status
        self.error = error
        self.message = message
        self.data = data


@dataclass
class AccessToken:
    access_token: str
    refresh_token: str
    expire_in: int
    shop_id: Optional[int] = None
    expired_at: float = 0.0


@dataclass
class EndpointSpec:
    api_name: str
    module: str
    action: str
    method: str
    path: str
    api_type: str
    auth: bool
    description: str


class DynamicSchemaModule:
    """
    Provides dynamic method access for any Shopee v2 module (e.g. client.ads, client.livestream)
    backed by the 455 official Shopee v2 JSON schemas.
    """

    def __init__(self, client: ShopeeClient, module_name: str):
        self.client = client
        self.module_name = module_name

    def list_methods(self) -> List[str]:
        return sorted(self.client._schema_registry.get(self.module_name, {}).keys())

    def __getattr__(self, action: str) -> Callable[..., Any]:
        mod_map = self.client._schema_registry.get(self.module_name, {})
        spec = mod_map.get(action)
        if not spec:
            raise AttributeError(
                f"Shopee module '{self.module_name}' has no endpoint '{action}'. "
                f"Available: {', '.join(self.list_methods())}"
            )

        def _endpoint_caller(
            payload: Optional[Dict[str, Any]] = None,
            *,
            params: Optional[Dict[str, Any]] = None,
            body: Optional[Dict[str, Any]] = None,
            **kwargs: Any,
        ) -> Any:
            merged: Dict[str, Any] = {}
            if payload:
                merged.update(payload)
            if kwargs:
                merged.update(kwargs)
            req_params = params if params is not None else (merged if spec.method == "GET" else None)
            req_body = body if body is not None else (merged if spec.method != "GET" else None)
            return self.client.request(
                spec.method,
                spec.path,
                params=req_params,
                body=req_body,
                auth=spec.auth,
            )

        _endpoint_caller.__name__ = action
        _endpoint_caller.__doc__ = f"{spec.api_name} ({spec.method} /api/v2{spec.path}): {spec.description}"
        return _endpoint_caller


class ShopeeClient:
    """
    Full-featured Python client for Shopee Open Platform v2 supporting all 455 API schemas
    across all 31 Shopee v2 modules.
    """

    def __init__(
        self,
        partner_id: int,
        partner_key: str,
        shop_id: Optional[int] = None,
        base_url: str = "http://localhost:3000/api/v2",
        base_auth_url: str = "http://localhost:3000/auth",
        schemas_dir: Optional[Union[str, Path]] = None,
        timeout: int = 30,
    ):
        self.partner_id = int(partner_id)
        self.partner_key = str(partner_key)
        self.shop_id = int(shop_id) if shop_id is not None else None
        self.base_url = base_url.rstrip("/")
        self.base_auth_url = base_auth_url.rstrip("/")
        self.timeout = timeout
        self.token: Optional[AccessToken] = None

        # Load all 455 official Shopee v2 schemas
        default_schemas_dir = Path(__file__).resolve().parent.parent / "shopee-sdk" / "schemas"
        self.schemas_dir = Path(schemas_dir) if schemas_dir else default_schemas_dir
        self._schema_registry: Dict[str, Dict[str, EndpointSpec]] = {}
        self._schemas_by_name: Dict[str, EndpointSpec] = {}
        self._load_schemas()

        # Core explicit domain managers (also inherit dynamic schema fallback via DynamicSchemaModule)
        self.public = PublicManager(self)
        self.shop = ShopManager(self)
        self.product = ProductManager(self)
        self.order = OrderManager(self)
        self.logistics = LogisticsManager(self)
        self.payment = PaymentManager(self)
        self.voucher = VoucherManager(self)
        self.discount = DiscountManager(self)
        self.bundle_deal = BundleDealManager(self)
        self.follow_prize = FollowPrizeManager(self)
        self.shop_category = ShopCategoryManager(self)
        self.returns = ReturnsManager(self)
        self.media_space = MediaSpaceManager(self)

        # Attach all remaining Shopee v2 modules dynamically (31 modules total, 455 endpoints)
        for mod_name in self._schema_registry:
            if not hasattr(self, mod_name):
                setattr(self, mod_name, DynamicSchemaModule(self, mod_name))

    def _load_schemas(self) -> None:
        if not self.schemas_dir.exists():
            return
        for path_obj in sorted(self.schemas_dir.glob("*.json")):
            try:
                raw = json.loads(path_obj.read_text(encoding="utf-8"))
                api_name = raw.get("api_name", "")
                raw_path = raw.get("path", "")
                if not api_name or not raw_path:
                    continue
                parts = api_name.split(".")
                if len(parts) < 3:
                    continue
                module_name = parts[1]
                action_name = "_".join(parts[2:])
                short_path = raw_path[len("/api/v2") :] if raw_path.startswith("/api/v2") else raw_path
                method = "POST" if raw.get("method") == 1 else "GET"
                api_type = raw.get("api_type", "Shop")
                auth = api_type != "Public" and "/auth/" not in raw_path and "/public/" not in raw_path
                define_obj = raw.get("define")
                desc = (
                    define_obj.get("content", "")
                    if isinstance(define_obj, dict)
                    else str(define_obj or "")
                ) or f"{method} {raw_path}"

                spec = EndpointSpec(
                    api_name=api_name,
                    module=module_name,
                    action=action_name,
                    method=method,
                    path=short_path,
                    api_type=api_type,
                    auth=auth,
                    description=desc,
                )
                self._schema_registry.setdefault(module_name, {})[action_name] = spec
                self._schemas_by_name[api_name] = spec
            except Exception:
                continue

    def list_modules(self) -> List[str]:
        """Return sorted list of all loaded Shopee v2 API modules (31 modules)."""
        return sorted(self._schema_registry.keys())

    def list_endpoints(self, module: Optional[str] = None) -> List[str]:
        """Return all loaded Shopee v2 api_name strings (455 endpoints), optionally filtered by module."""
        if module:
            return [spec.api_name for spec in self._schema_registry.get(module, {}).values()]
        return sorted(self._schemas_by_name.keys())

    def call_api(
        self,
        api_name: str,
        payload: Optional[Dict[str, Any]] = None,
        *,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Call any of the 455 Shopee v2 endpoints by its official schema name,
        e.g. client.call_api("v2.shop_flash_sale.get_item_criteria")
        """
        spec = self._schemas_by_name.get(api_name)
        if not spec:
            raise ValueError(f"Unknown Shopee v2 schema '{api_name}'. Loaded schemas: {len(self._schemas_by_name)}")
        merged: Dict[str, Any] = {}
        if payload:
            merged.update(payload)
        if kwargs:
            merged.update(kwargs)
        req_params = params if params is not None else (merged if spec.method == "GET" else None)
        req_body = body if body is not None else (merged if spec.method != "GET" else None)
        return self.request(
            spec.method,
            spec.path,
            params=req_params,
            body=req_body,
            auth=spec.auth,
        )

    def generate_signature(self, api_path: str, timestamp: int, auth: bool = False) -> str:
        """
        Compute Shopee v2 HMAC-SHA256 signature:
        - Public/Auth APIs: partner_id + api_path + timestamp
        - Shop APIs:        partner_id + api_path + timestamp + access_token + shop_id
        """
        parts = [str(self.partner_id), api_path, str(timestamp)]
        if auth:
            if not self.token or not self.token.access_token:
                raise ValueError("No access_token available. Call authenticate_with_code() first.")
            shop_id = self.token.shop_id or self.shop_id
            parts.extend([self.token.access_token, str(shop_id)])
        base_string = "".join(parts)
        return hmac.new(
            self.partner_key.encode("utf-8"),
            base_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def get_authorization_url(
        self,
        redirect_uri: str,
        auth_type: str = "seller",
        state: Optional[str] = None,
    ) -> str:
        """Build OAuth authorization URL."""
        params: Dict[str, str] = {
            "partner_id": str(self.partner_id),
            "auth_type": auth_type,
            "redirect_uri": redirect_uri,
            "response_type": "code",
        }
        if state:
            params["state"] = state
        return f"{self.base_auth_url}?{urllib.parse.urlencode(params)}"

    def authenticate_with_code(
        self, code: str, shop_id: Optional[int] = None
    ) -> AccessToken:
        """Exchange authorization code for access_token & refresh_token."""
        target_shop_id = shop_id or self.shop_id
        body: Dict[str, Any] = {
            "code": code,
            "partner_id": self.partner_id,
        }
        if target_shop_id is not None:
            body["shop_id"] = int(target_shop_id)

        res = self.request("POST", "/auth/token/get", body=body, auth=False)
        payload = res if "access_token" in res else res.get("response", {})
        expire_in = int(payload.get("expire_in", 14400))
        self.token = AccessToken(
            access_token=payload["access_token"],
            refresh_token=payload["refresh_token"],
            expire_in=expire_in,
            shop_id=target_shop_id,
            expired_at=time.time() + expire_in - 60,
        )
        return self.token

    def refresh_access_token(self, shop_id: Optional[int] = None) -> AccessToken:
        """Refresh the current access_token using refresh_token."""
        if not self.token or not self.token.refresh_token:
            raise ValueError("No refresh_token available to refresh.")
        target_shop_id = shop_id or self.token.shop_id or self.shop_id
        body: Dict[str, Any] = {
            "partner_id": self.partner_id,
            "refresh_token": self.token.refresh_token,
        }
        if target_shop_id is not None:
            body["shop_id"] = int(target_shop_id)

        res = self.request("POST", "/auth/access_token/get", body=body, auth=False)
        payload = res if "access_token" in res else res.get("response", {})
        expire_in = int(payload.get("expire_in", 14400))
        self.token = AccessToken(
            access_token=payload["access_token"],
            refresh_token=payload["refresh_token"],
            expire_in=expire_in,
            shop_id=target_shop_id,
            expired_at=time.time() + expire_in - 60,
        )
        return self.token

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
        auth: bool = True,
    ) -> Union[Dict[str, Any], bytes]:
        """Execute a signed HTTP request to Shopee Open Platform v2."""
        if path.startswith("/api/v2/"):
            path = path[len("/api/v2") :]
        if not path.startswith("/"):
            path = "/" + path
        full_url_base = f"{self.base_url}{path}"
        parsed_url = urllib.parse.urlparse(full_url_base)
        api_path = parsed_url.path

        if auth:
            if self.token and self.token.expired_at and time.time() > self.token.expired_at:
                self.refresh_access_token()
            if not self.token:
                raise ValueError("No access token found. Call authenticate_with_code() first.")

        timestamp = int(time.time())
        sign = self.generate_signature(api_path, timestamp, auth=auth)

        query_pairs: List[tuple[str, str]] = []
        if params:
            for k, v in params.items():
                if v is None:
                    continue
                if isinstance(v, (list, tuple)):
                    for item in v:
                        query_pairs.append((k, str(item)))
                elif isinstance(v, bool):
                    query_pairs.append((k, "true" if v else "false"))
                else:
                    query_pairs.append((k, str(v)))

        query_pairs.append(("partner_id", str(self.partner_id)))
        query_pairs.append(("timestamp", str(timestamp)))
        if auth and self.token:
            query_pairs.append(("access_token", self.token.access_token))
            query_pairs.append(("shop_id", str(self.token.shop_id or self.shop_id)))
        query_pairs.append(("sign", sign))

        url = f"{full_url_base}?{urllib.parse.urlencode(query_pairs)}"
        data_bytes = json.dumps(body if body is not None else {}).encode("utf-8") if method.upper() != "GET" else None
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "python-shopee-sdk/2.0.0",
        }

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                content_type = resp.headers.get("Content-Type", "")
                raw_bytes = resp.read()
                if "application/pdf" in content_type or "application/octet-stream" in content_type:
                    return raw_bytes
                data = json.loads(raw_bytes.decode("utf-8"))
                if isinstance(data, dict) and data.get("error"):
                    raise ShopeeApiError(
                        resp.status,
                        str(data.get("error")),
                        str(data.get("message", "")),
                        data,
                    )
                return data
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_body)
                raise ShopeeApiError(
                    e.code,
                    str(err_json.get("error", "http_error")),
                    str(err_json.get("message", err_body)),
                    err_json,
                ) from None
            except json.JSONDecodeError:
                raise ShopeeApiError(e.code, "http_error", err_body) from None


class PublicManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "public")

    def get_shopee_ip_ranges(self) -> Dict[str, Any]:
        return self.client.request("GET", "/public/get_shopee_ip_ranges", auth=False)  # type: ignore

    def get_shops_by_partner(self, page_no: int = 1, page_size: int = 20) -> Dict[str, Any]:
        return self.client.request(
            "GET",
            "/public/get_shops_by_partner",
            params={"page_no": page_no, "page_size": page_size},
            auth=False,
        )  # type: ignore


class ShopManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "shop")

    def get_shop_info(self) -> Dict[str, Any]:
        return self.client.request("GET", "/shop/get_shop_info", auth=True)  # type: ignore

    def get_profile(self) -> Dict[str, Any]:
        return self.client.request("GET", "/shop/get_profile", auth=True)  # type: ignore

    def update_profile(self, shop_name: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {}
        if shop_name is not None:
            body["shop_name"] = shop_name
        if description is not None:
            body["description"] = description
        return self.client.request("POST", "/shop/update_profile", body=body, auth=True)  # type: ignore


class ProductManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "product")

    def get_category(self) -> Dict[str, Any]:
        return self.client.request("GET", "/product/get_category", auth=True)  # type: ignore

    def get_item_list(
        self, offset: int = 0, page_size: int = 20, item_status: str = "NORMAL"
    ) -> Dict[str, Any]:
        return self.client.request(
            "GET",
            "/product/get_item_list",
            params={"offset": offset, "page_size": page_size, "item_status": item_status},
            auth=True,
        )  # type: ignore

    def get_item_base_info(self, item_id_list: List[int]) -> Dict[str, Any]:
        return self.client.request(
            "GET",
            "/product/get_item_base_info",
            params={"item_id_list": item_id_list},
            auth=True,
        )  # type: ignore

    def add_item(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request("POST", "/product/add_item", body=payload, auth=True)  # type: ignore

    def update_item(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request("POST", "/product/update_item", body=payload, auth=True)  # type: ignore

    def update_price(self, item_id: int, price_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.client.request(
            "POST",
            "/product/update_price",
            body={"item_id": item_id, "price_list": price_list},
            auth=True,
        )  # type: ignore

    def update_stock(self, item_id: int, stock_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.client.request(
            "POST",
            "/product/update_stock",
            body={"item_id": item_id, "stock_list": stock_list},
            auth=True,
        )  # type: ignore

    def delete_item(self, item_id: int) -> Dict[str, Any]:
        return self.client.request(
            "POST", "/product/delete_item", body={"item_id": item_id}, auth=True
        )  # type: ignore


class OrderManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "order")

    def get_order_list(
        self,
        time_range_field: str = "create_time",
        time_from: int = 0,
        time_to: Optional[int] = None,
        page_size: int = 20,
        order_status: Optional[str] = None,
        cursor: str = "",
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "time_range_field": time_range_field,
            "time_from": time_from,
            "time_to": time_to if time_to is not None else int(time.time()),
            "page_size": page_size,
        }
        if order_status:
            params["order_status"] = order_status
        if cursor:
            params["cursor"] = cursor
        return self.client.request("GET", "/order/get_order_list", params=params, auth=True)  # type: ignore

    def get_order_detail(self, order_sn_list: List[str]) -> Dict[str, Any]:
        return self.client.request(
            "GET",
            "/order/get_order_detail",
            params={"order_sn_list": order_sn_list},
            auth=True,
        )  # type: ignore


class LogisticsManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "logistics")

    def get_channel_list(self) -> Dict[str, Any]:
        return self.client.request("GET", "/logistics/get_channel_list", auth=True)  # type: ignore

    def get_shipping_parameter(self, order_sn: str) -> Dict[str, Any]:
        return self.client.request(
            "GET", "/logistics/get_shipping_parameter", params={"order_sn": order_sn}, auth=True
        )  # type: ignore

    def ship_order(self, order_sn: str, pickup: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"order_sn": order_sn}
        if pickup:
            body["pickup"] = pickup
        return self.client.request("POST", "/logistics/ship_order", body=body, auth=True)  # type: ignore

    def get_tracking_number(self, order_sn: str) -> Dict[str, Any]:
        return self.client.request(
            "GET", "/logistics/get_tracking_number", params={"order_sn": order_sn}, auth=True
        )  # type: ignore

    def create_shipping_document(self, order_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.client.request(
            "POST",
            "/logistics/create_shipping_document",
            body={"order_list": order_list},
            auth=True,
        )  # type: ignore

    def get_shipping_document_result(self, order_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.client.request(
            "POST",
            "/logistics/get_shipping_document_result",
            body={"order_list": order_list},
            auth=True,
        )  # type: ignore

    def download_shipping_document(self, order_list: List[Dict[str, Any]]) -> bytes:
        res = self.client.request(
            "POST",
            "/logistics/download_shipping_document",
            body={"order_list": order_list},
            auth=True,
        )
        if not isinstance(res, bytes):
            raise TypeError(f"Expected PDF bytes, got: {res}")
        return res


class PaymentManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "payment")

    def get_payment_method_list(self) -> Dict[str, Any]:
        return self.client.request("GET", "/payment/get_payment_method_list", auth=False)  # type: ignore

    def get_escrow_detail(self, order_sn: str) -> Dict[str, Any]:
        return self.client.request(
            "GET", "/payment/get_escrow_detail", params={"order_sn": order_sn}, auth=True
        )  # type: ignore


class VoucherManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "voucher")

    def add_voucher(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request("POST", "/voucher/add_voucher", body=payload, auth=True)  # type: ignore

    def get_voucher_list(self, status: str = "all", page_no: int = 1, page_size: int = 10) -> Dict[str, Any]:
        return self.client.request(
            "GET",
            "/voucher/get_voucher_list",
            params={"status": status, "page_no": page_no, "page_size": page_size},
            auth=True,
        )  # type: ignore

    def delete_voucher(self, voucher_id: int) -> Dict[str, Any]:
        return self.client.request(
            "POST", "/voucher/delete_voucher", body={"voucher_id": voucher_id}, auth=True
        )  # type: ignore


class DiscountManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "discount")


class BundleDealManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "bundle_deal")


class FollowPrizeManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "follow_prize")


class ShopCategoryManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "shop_category")


class ReturnsManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "returns")


class MediaSpaceManager(DynamicSchemaModule):
    def __init__(self, client: ShopeeClient):
        super().__init__(client, "media_space")
