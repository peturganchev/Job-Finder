import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import streamlit as st
from supabase import create_client, Client
from streamlit_cookies_controller import CookieController

load_dotenv()

# Инициализация на контролера за бисквитки
controller = CookieController()


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
    """Връща текущо логнатия потребител от сесията или от запазена бисквитка, с автоматичен рефреш на токена."""
    user = None
    if "user" in st.session_state and st.session_state["user"]:
        user = st.session_state["user"]
    else:
        # Проверка за запазена сесия след рефреш
        cookie_user = controller.get("job_finder_session")
        if cookie_user:
            user = cookie_user
            st.session_state["user"] = user

    if not user:
        return None

    client = get_supabase_client()
    if client and user.get("access_token"):
        # Проверяваме дали токенът все още е валиден през Supabase Auth
        try:
            u_check = client.auth.get_user(user["access_token"])
            if not u_check or not u_check.user:
                raise ValueError("Невалиден или изтекъл токен")
        except Exception:
            # Токенът е изтекъл или невалиден -> Опитваме авто-рефреш с refresh_token
            refreshed = False
            if user.get("refresh_token"):
                try:
                    res = client.auth.refresh_session(user["refresh_token"])
                    if res and res.session:
                        user["access_token"] = res.session.access_token
                        user["refresh_token"] = res.session.refresh_token
                        st.session_state["user"] = user
                        controller.set("job_finder_session", user, max_age=30 * 24 * 60 * 60)
                        refreshed = True
                except Exception as ref_err:
                    print(f"⚠️ Грешка при рефреш на сесия: {ref_err}")
            
            if not refreshed:
                # Ако няма refresh_token или рефрешът е неуспешен, изчистваме остарялата сесия
                print("ℹ️ Сесията е изтекла. Изчистване на бисквитката.")
                if "user" in st.session_state:
                    del st.session_state["user"]
                controller.remove("job_finder_session")
                return None

    return user


def sign_in_user(email: str, password: str) -> tuple[bool, str]:
    """Вход с имейл и парола през Supabase."""
    client = get_supabase_client()
    if not client:
        return False, "Supabase не е конфигуриран."
    try:
        res = client.auth.sign_in_with_password({"email": email, "password": password})
        if res.user:
            user_data = {
                "id": str(res.user.id),
                "email": res.user.email,
                "access_token": res.session.access_token if res.session else None,
                "refresh_token": res.session.refresh_token if res.session else None
            }
            st.session_state["user"] = user_data
            # Запазваме сесията в бисквитка за 30 дни
            controller.set("job_finder_session", user_data, max_age=30 * 24 * 60 * 60)
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
    
    # Изтриваме бисквитката
    controller.remove("job_finder_session")
    st.rerun()


def load_user_profile(user_id: str) -> Dict[str, Any]:
    """Зарежда личните настройки и API ключ на потребителя от Supabase."""
    client = get_supabase_client()
    if not client:
        return {}
    try:
        user = st.session_state.get("user")
        if user and user.get("access_token"):
            client.postgrest.auth(user["access_token"])
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
        user = st.session_state.get("user")
        if user and user.get("access_token"):
            client.postgrest.auth(user["access_token"])
        payload = {
            "user_id": str(user_id),
            **settings
        }
        res = client.table("user_settings").upsert(payload, on_conflict="user_id").execute()
        return len(res.data) > 0
    except Exception as e:
        print(f"⚠️ Грешка при запазване в Supabase: {e}")
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
