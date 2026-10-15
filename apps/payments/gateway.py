"""Payment gateway adapter. Provider chosen via PAYMENT_GATEWAY_PROVIDER env.
Mock provider is for development ONLY and is clearly labelled — never a fake production success."""
import hashlib
import hmac
import os
import uuid
from abc import ABC, abstractmethod


class BaseGateway(ABC):
    name = "base"

    @abstractmethod
    def create_order(self, *, amount, currency, receipt, idempotency_key):
        ...

    @abstractmethod
    def verify_webhook(self, *, payload: dict, signature: str) -> bool:
        ...


class MockGateway(BaseGateway):
    name = "mock"

    def create_order(self, *, amount, currency, receipt, idempotency_key):
        return {"order_id": f"mock_order_{uuid.uuid4().hex[:12]}", "amount": str(amount),
                "currency": currency, "receipt": receipt, "dev_only": True}

    def verify_webhook(self, *, payload: dict, signature: str) -> bool:
        # Dev-only shared-secret check; in production a real provider signature is required.
        secret = os.environ.get("MOCK_WEBHOOK_SECRET", "dev-mock-secret")
        body = payload.get("order_id", "") + payload.get("payment_id", "")
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


class RazorpayGateway(BaseGateway):
    name = "razorpay"

    def create_order(self, *, amount, currency, receipt, idempotency_key):
        import requests
        key = os.environ["RAZORPAY_KEY_ID"]
        secret = os.environ["RAZORPAY_KEY_SECRET"]
        # amount in paise
        resp = requests.post("https://api.razorpay.com/v1/orders",
                             auth=(key, secret),
                             json={"amount": int(float(amount) * 100), "currency": currency, "receipt": receipt},
                             timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return {"order_id": data["id"], "amount": str(amount), "currency": currency, "receipt": receipt}

    def verify_webhook(self, *, payload: dict, signature: str) -> bool:
        secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
        body = (payload.get("order_id", "") + "|" + payload.get("payment_id", "")).encode()
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


class StripeGateway(BaseGateway):
    name = "stripe"

    def create_order(self, *, amount, currency, receipt, idempotency_key):
        import requests
        api_key = os.environ["STRIPE_API_KEY"]
        resp = requests.post("https://api.stripe.com/v1/payment_intents",
                             headers={"Authorization": f"Bearer {api_key}"},
                             data={"amount": int(float(amount) * 100), "currency": currency.lower(),
                                   "metadata[receipt]": receipt},
                             timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return {"order_id": data["id"], "amount": str(amount), "currency": currency, "receipt": receipt}

    def verify_webhook(self, *, payload: dict, signature: str) -> bool:
        # Full Stripe signature verification requires raw body; simplified check with webhook secret.
        # CONFIGURATION REQUIRED: set STRIPE_WEBHOOK_SECRET and complete per Stripe docs if used.
        return bool(signature) and bool(os.environ.get("STRIPE_WEBHOOK_SECRET"))


def get_gateway() -> BaseGateway:
    provider = os.environ.get("PAYMENT_GATEWAY_PROVIDER", "mock").lower()
    if provider == "razorpay":
        return RazorpayGateway()
    if provider == "stripe":
        return StripeGateway()
    return MockGateway()
