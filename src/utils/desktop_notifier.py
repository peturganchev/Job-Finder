"""
Desktop Notification Utility for Windows.
Plays a chime sound and displays a native Windows Action Center Toast Notification.
"""
import sys
import subprocess

def notify_desktop(title: str, message: str):
    """Изпраща звуков сигнал и Windows Toast нотификация на десктопа."""
    # Звуков сигнал
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
    except Exception:
        pass

    if sys.platform != "win32":
        return

    # Windows WinRT Toast Notification
    safe_title = title.replace("'", "''").replace('"', '')
    safe_msg = message.replace("'", "''").replace('"', '')
    
    ps_cmd = f"""
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $textNodes = $template.GetElementsByTagName('text')
    $textNodes.Item(0).AppendChild($template.CreateTextNode('{safe_title}')) | Out-Null
    $textNodes.Item(1).AppendChild($template.CreateTextNode('{safe_msg}')) | Out-Null
    $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Job-Finder').Show($toast)
    """
    try:
        subprocess.Popen(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_cmd])
    except Exception:
        pass
