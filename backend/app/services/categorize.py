"""Cheap rule-based categorizer. Keyword match on merchant/description.

Deliberately deterministic: zero LLM cost for the common case. Anything that
doesn't match falls through to 'uncategorized' and can be classified later in
batches by the LLM if needed.
"""
import re

RULES = [
    ("groceries", ["whole foods", "trader joe", "safeway", "kroger", "aldi", "walmart grocery", "wegmans", "publix", "costco"]),
    ("dining", ["starbucks", "mcdonald", "chipotle", "uber eats", "doordash", "grubhub", "restaurant", "cafe", "coffee", "pizza", "sushi"]),
    ("transport", ["uber", "lyft", "shell", "chevron", "exxon", "bp ", "gas station", "parking", "metro", "transit"]),
    ("subscriptions", ["netflix", "spotify", "hulu", "disney+", "apple.com/bill", "icloud", "youtube premium", "prime video", "hbo", "adobe"]),
    ("utilities", ["pg&e", "comcast", "xfinity", "verizon", "at&t", "t-mobile", "water", "electric", "internet"]),
    ("rent", ["rent", "landlord", "apartments", "property mgmt"]),
    ("shopping", ["amazon", "target", "best buy", "ebay", "etsy", "nike", "zara", "h&m"]),
    ("health", ["pharmacy", "cvs", "walgreens", "doctor", "clinic", "hospital", "dental"]),
    ("entertainment", ["cinema", "amc theatres", "ticketmaster", "steam", "playstation", "xbox"]),
    ("income", ["payroll", "salary", "direct deposit", "deposit from"]),
    ("transfer", ["zelle", "venmo", "cash app", "transfer to", "transfer from"]),
]


def categorize(merchant: str, description: str = "") -> str:
    text = f"{merchant} {description}".lower()
    for cat, keywords in RULES:
        for kw in keywords:
            if kw in text:
                return cat
    return "uncategorized"


def normalize_merchant(raw: str) -> str:
    if not raw:
        return ""
    s = raw.strip()
    # Strip common payment-processor prefixes/suffixes
    s = re.sub(r"^(SQ \*|TST\*|SP \*|PAYPAL \*|POS DEBIT |ACH DEBIT )", "", s, flags=re.I)
    s = re.sub(r"\s+#?\d{3,}.*$", "", s)  # trailing store numbers
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip().title()
