import requests

url = "http://localhost:8000/api/login/"
data = {"username": "doctor@medos.com", "password": "doctor123"}
r = requests.post(url, json=data)
if r.status_code == 200:
    token = r.json().get("token")
    headers = {"Authorization": f"Token {token}"}
    r2 = requests.get("http://localhost:8000/api/bed-map/", headers=headers)
    print(r2.status_code)
    print(r2.text)
else:
    print("Login failed:", r.status_code, r.text)

