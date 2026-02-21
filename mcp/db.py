from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from config import MONGODB_URI, DB_NAME, COLLECTIONS

_client = None
_db = None

def get_db():
    global _client, _db
    
    if _db is not None:
        return _db
    
    try:
        _client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        # Ping to verify connection
        _client.admin.command('ping')
        _db = _client[DB_NAME]
        print(f"✅ MongoDB connected: {DB_NAME}")
        return _db
    except ConnectionFailure as e:
        raise ConnectionError(f"❌ MongoDB connection failed: {e}")


def get_collection(name: str):
    """
    Get a collection by its key name from COLLECTIONS dict.
    e.g. get_collection('audit_logs')
    """
    db = get_db()
    collection_name = COLLECTIONS.get(name)
    if not collection_name:
        raise ValueError(
            f"Unknown collection key '{name}'. "
            f"Valid keys: {list(COLLECTIONS.keys())}"
        )
    return db[collection_name]


def serialize_doc(doc: dict) -> dict:
    """
    Convert MongoDB ObjectId and other non-serializable
    types to strings for JSON output.
    """
    if doc is None:
        return None

    result = {}
    for key, value in doc.items():
        if key == "_id":
            result[key] = str(value)
        elif hasattr(value, 'isoformat'):
            # datetime → ISO string
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [
                serialize_doc(v) if isinstance(v, dict) else str(v)
                if hasattr(v, '__class__') and v.__class__.__name__ == 'ObjectId'
                else v
                for v in value
            ]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif hasattr(value, '__class__') and value.__class__.__name__ == 'ObjectId':
            result[key] = str(value)
        else:
            result[key] = value
    return result


def serialize_docs(docs: list) -> list:
    """Serialize a list of MongoDB documents."""
    return [serialize_doc(doc) for doc in docs]
