import os
from dotenv import load_dotenv
load_dotenv('backend/.env')
from sqlalchemy import create_engine, text

engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    print("=== FOREIGN KEYS FOR PHASE 3 TABLES ===")
    query = """
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name IN ('profiles', 'organisations', 'organisation_members')
        ORDER BY tc.table_name, kcu.column_name;
    """
    fks = conn.execute(text(query)).fetchall()
    for fk in fks:
        print(f"{fk[1]}.{fk[2]} ({fk[0]}) -> {fk[3]}.{fk[4]}.{fk[5]}")

    print("\n=== PROFILE ROWS ===")
    profs = conn.execute(text("SELECT id, full_name FROM public.profiles")).fetchall()
    print(profs)

    print("\n=== AUTH.USERS VS PUBLIC.USERS ID COMPARISON ===")
    auth_users = conn.execute(text("SELECT id, email FROM auth.users")).fetchall()
    pub_users = conn.execute(text("SELECT id, email FROM public.users")).fetchall()
    print(f"auth.users count: {len(auth_users)}")
    for au in auth_users:
        print(f"  auth.user: id={au[0]} ({type(au[0])}), email={au[1]}")
    print(f"public.users count: {len(pub_users)}")
    for pu in pub_users:
        print(f"  public.user: id={pu[0]} ({type(pu[0])}), email={pu[1]}")
