import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import streamlit as st
from supabase import create_client, Client

load_dotenv()


def get_supabase_client() -> Optional[Client]:
    """Връща Supabase клиент, ако променливите са дефинирани."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    if url and key:
        try:
            return create_client(url, key)
        except Exception as e:
            st.error(f"Грешка при свързване със Supabase Auth: {e}")
    return None


def is_auth_enabled() -> bool:
    """Проверява дали Supabase автентикацията е конфигурирана."""
    return get_supabase_client() is not None


def get_current_user() -> Optional[Dict[str, Any]]:
    """Връща текущо логнатия потребител от Streamlit сесията."""
    return st.session_state.get("user")


def sign_in_user(email: str, password: str) -> tuple[bool, str]:
    """Вход с имейл и парола през Supabase."""
    client = get_supabase_client()
    if not client:
        return False, "Supabase не е конфигуриран."
    try:
        res = client.auth.sign_in_with_password({"email": email, "password": password})
        if res.user:
            st.session_state["user"] = {
                "id": str(res.user.id),
                "email": res.user.email,
                "access_token": res.session.access_token if res.session else None
            }
            return True, "Успешен вход!"
        return False, "Невалидни данни за вход."
    except Exception as e:
        return False, str(e)


def sign_up_user(email: str, password: str) -> tuple[bool, str]:
    """Регистрация на нов потребител през Supabase."""
    client = get_supabase_client()
    if not client:
        return False, "Supabase не е конфигуриран."
    try:
        res = client.auth.sign_up({"email": email, "password": password})
        if res.user:
            return True, "Успешна регистрация! Провери имейла си за потвърждение (ако е изискано) или влез в профила си."
        return False, "Неуспешна регистрация."
    except Exception as e:
        return False, str(e)


def sign_out_user():
    """Изход от текущия потребителски профил."""
    client = get_supabase_client()
    if client:
        try:
            client.auth.sign_out()
        except Exception:
            pass
    if "user" in st.session_state:
        del st.session_state["user"]
    st.rerun()


def load_user_profile(user_id: str) -> Dict[str, Any]:
    """Зарежда личните настройки и API ключ на потребителя от Supabase."""
    client = get_supabase_client()
    if not client:
        return {}
    try:
        res = client.table("user_settings").select("*").eq("user_id", str(user_id)).limit(1).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"⚠️ Грешка при зареждане на потребителски настройки: {e}")
    return {}


def save_user_profile(user_id: str, settings: Dict[str, Any]) -> bool:
    """Запазва личните настройки и API ключ за потребителя в Supabase."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        payload = {
            "user_id": str(user_id),
            **settings
        }
        res = client.table("user_settings").upsert(payload, on_conflict="user_id").execute()
        return len(res.data) > 0
    except Exception as e:
        st.error(f"Грешка при запазване на настройките в Supabase: {e}")
        return False


def render_auth_view():
    """Визуализира интерфейс за вход / регистрация в дашборда."""
    col_l, col_center, col_r = st.columns([1, 1.6, 1])
    with col_center:
        st.markdown("<h2 style='text-align: center; margin-top: 1rem;'>🔐 Вход в Job Finder</h2>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: #888; margin-bottom: 1.5rem;'>Влез в профила си за достъп до AI анализите и обявите</p>", unsafe_allow_html=True)
        
        tab_login, tab_register = st.tabs(["🔑 Вход", "✨ Регистрация"])
        
        with tab_login:
            with st.form("login_form"):
                email = st.text_input("Имейл", key="login_email")
                password = st.text_input("Парола", type="password", key="login_pass")
                submit = st.form_submit_button("Влез", use_container_width=True, type="primary")
                
                if submit:
                    if not email or not password:
                        st.warning("Моля, попълни всички полета.")
                    else:
                        success, msg = sign_in_user(email, password)
                        if success:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(f"Грешка при вход: {msg}")

        with tab_register:
            with st.form("register_form"):
                reg_email = st.text_input("Имейл за регистрация", key="reg_email")
                reg_password = st.text_input("Парола (мин. 6 символа)", type="password", key="reg_pass")
                reg_submit = st.form_submit_button("Създай акаунт", use_container_width=True)
                
                if reg_submit:
                    if not reg_email or not reg_password:
                        st.warning("Моля, попълни всички полета.")
                    elif len(reg_password) < 6:
                        st.warning("Паролата трябва да е поне 6 символа.")
                    else:
                        success, msg = sign_up_user(reg_email, reg_password)
                        if success:
                            st.success(msg)
                        else:
                            st.error(f"Грешка при регистрация: {msg}")
