import os, sys
from dotenv import load_dotenv
load_dotenv('backend/.env')
sys.path.insert(0, 'backend')

from app.models.database import SessionLocal, User
from app.services.auth import hash_password

dummy_users = [
    {
        "id": "11111111-1111-4111-8111-111111111111",
        "email": "admin@ipsakti.gov.in",
        "full_name": "Admin Director",
        "role": "admin",
        "organization": "Ministry of AYUSH",
        "password": "Password@123",
    },
    {
        "id": "22222222-2222-4222-8222-222222222222",
        "email": "scientist@ccras.nic.in",
        "full_name": "Dr. Charaka Sharma",
        "role": "expert",
        "organization": "CCRAS Research Council",
        "password": "Password@123",
    },
    {
        "id": "33333333-3333-4333-8333-333333333333",
        "email": "attorney@ipfirm.in",
        "full_name": "Adv. Meera Sen",
        "role": "expert",
        "organization": "AYUSH IP Legal Services",
        "password": "Password@123",
    },
    {
        "id": "44444444-4444-4444-8444-444444444444",
        "email": "innovator@ayurstartup.co",
        "full_name": "Rohit Verma",
        "role": "user",
        "organization": "Patanjali Bio Innovations",
        "password": "Password@123",
    },
]

db = SessionLocal()
try:
    for u in dummy_users:
        existing = db.query(User).filter((User.email == u["email"]) | (User.id == u["id"])).first()
        hashed = hash_password(u["password"])
        if existing:
            existing.full_name = u["full_name"]
            existing.organization = u["organization"]
            existing.role = u["role"]
            existing.password_hash = hashed
            existing.is_active = True
            existing.is_verified = True
            print(f"Updated dummy user: {u['email']} (role: {u['role']})")
        else:
            new_u = User(
                id=u["id"],
                email=u["email"],
                full_name=u["full_name"],
                organization=u["organization"],
                role=u["role"],
                password_hash=hashed,
                is_active=True,
                is_verified=True,
            )
            db.add(new_u)
            print(f"Created dummy user: {u['email']} (role: {u['role']})")
    db.commit()
    print("\nSUCCESS: All 4 dummy test users are committed into the database!")
finally:
    db.close()
