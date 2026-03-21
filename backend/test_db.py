import asyncio
from app.services.supabase_service import get_supabase

def test_db():
    sb = get_supabase()
    try:
        res = sb.table("notifications").select("*").limit(1).execute()
        print("notifications table exists:", res.data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_db()
