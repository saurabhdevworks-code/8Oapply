with open('jobbot.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Upgrade check_and_handle_captcha
new_captcha_fn = '''def check_and_handle_captcha(driver, wait_seconds=60):
    """
    Detects Cloudflare Turnstile, 'Verify you are human', or 'Additional Verification Required'.
    Plays audio alert, attempts auto-click, and gives user up to 60 seconds to pass.
    Automatically saves cookies upon clearance so it never challenges again.
    """
    indicators = [
        "verify you are human",
        "verify you are not a robot",
        "additional verification required",
        "just a moment...",
        "just a moment",
        "checking your browser",
        "security check",
        "challenges.cloudflare.com",
        "turnstile",
        "ray id",
    ]
    try:
        page_src = driver.page_source.lower()
        title = driver.title.lower()
    except Exception:
        return True

    detected = any(ind in page_src for ind in indicators) or any(ind in title for ind in indicators)
    if not detected:
        return True

    # Audible alert for user
    try:
        import winsound
        winsound.Beep(1200, 350)
    except Exception:
        pass

    log.warning("⚠️  'Verify you are human' / Cloudflare challenge active on screen!")
    log.info("👉 ACTION REQUIRED: Please click the 'Verify you are human' checkbox in the open Chrome window!")
    log.info(f"⏳ Waiting up to {wait_seconds}s for checkbox click or auto-verification...")

    # Attempt auto-click on Turnstile
    try:
        frames = driver.find_elements(By.CSS_SELECTOR, "iframe[src*='challenges.cloudflare.com'], iframe[src*='cloudflare'], iframe[src*='turnstile'], iframe[title*='widget']")
        for frame in frames:
            try:
                driver.switch_to.frame(frame)
                time.sleep(0.5)
                cbs = driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox'], #cf-stage, .ctp-checkbox-label, .mark, label.cb-lb")
                if cbs:
                    from selenium.webdriver.common.action_chains import ActionChains
                    ActionChains(driver).move_to_element(cbs[0]).pause(0.2).click().perform()
                    log.info("🤖 Auto-click attempted on Cloudflare Turnstile checkbox!")
                driver.switch_to.default_content()
            except Exception:
                driver.switch_to.default_content()
    except Exception:
        pass

    # Polling loop
    start_t = time.time()
    while time.time() - start_t < wait_seconds:
        time.sleep(1.5)
        try:
            curr_src = driver.page_source.lower()
            curr_title = driver.title.lower()
            turnstile_cleared = (
                "additional verification required" not in curr_src
                and "verify you are human" not in curr_src
                and "just a moment" not in curr_title
            )
            job_found = bool(driver.find_elements(By.CSS_SELECTOR, ".job_seen_beacon, .resultContent, [data-jk], div.cardOutline, #jobsearch-Main, header, nav"))
            if turnstile_cleared or job_found:
                log.info("🎉 Cloudflare verification PASSED successfully! Saving clearance cookies to disk...")
                save_cookies(driver, "indeed")
                time.sleep(2)
                return True
        except Exception:
            pass

    log.warning("⚠️ Verification wait timed out — attempting to proceed anyway...")
    return False'''

import re
code = re.sub(r'def check_and_handle_captcha\(driver, wait_seconds=\d+\):.*?(?=\ndef indeed_bot|\ndef make_driver|\n#)', new_captcha_fn + '\n', code, flags=re.DOTALL)

# 2. Upgrade indeed_bot
old_indeed_start = '''def indeed_bot():
    log.info("▶️▶️▶️ Indeed Bot Starting ◀️◀️◀️")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        log.info("Indeed: Login check kar raha hoon...")
        try:
            driver.get("https://in.indeed.com/")
            human_delay(3, 5)
            check_and_handle_captcha(driver)'''

new_indeed_start = '''def indeed_bot():
    log.info("▶️▶️▶️ Indeed Bot Starting ◀️◀️◀️")
    driver = make_driver()
    applied = 0

    try:
        # 1. Load saved cookies (session + Cloudflare cf_clearance tokens)
        cookie_loaded = load_cookies(driver, "indeed", "https://in.indeed.com")
        if cookie_loaded:
            log.info("Indeed: 🍪 Loaded saved session & Cloudflare clearance cookies")

        logged_in = False
        log.info("Indeed: Login check kar raha hoon...")
        try:
            driver.get("https://in.indeed.com/")
            human_delay(3, 5)
            check_and_handle_captcha(driver)'''

code = code.replace(old_indeed_start, new_indeed_start)

# In indeed login section, only try credentials if password is provided
old_cred_block = '''        if not logged_in:
            # Try credentials login
            try:
                driver.get("https://in.indeed.com/account/login")
                human_delay(4, 6)
                email_f = wait_for(driver, By.CSS_SELECTOR, "input[type=email], #ifl-InputFormField-3", timeout=15)
                type_human(email_f, CONFIG["indeed_email"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                human_delay(3, 5)
                try:
                    pwd = driver.find_element(By.CSS_SELECTOR, "input[type=password]")
                    type_human(pwd, CONFIG["indeed_password"])
                    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                except Exception:
                    pass
                human_delay(5, 8)
                logged_in = True
                log.info("Indeed: ✅ Logged in via credentials")
            except Exception as e:
                log.warning(f"Indeed: Login issue → {e}")
                time.sleep(CONFIG["manual_login_wait"])
                logged_in = True  # Continue anyway, some pages work without login'''

new_cred_block = '''        if not logged_in:
            if CONFIG.get("indeed_password"):
                try:
                    driver.get("https://in.indeed.com/account/login")
                    human_delay(3, 5)
                    check_and_handle_captcha(driver)
                    email_f = wait_for(driver, By.CSS_SELECTOR, "input[type=email], #ifl-InputFormField-3", timeout=12)
                    type_human(email_f, CONFIG["indeed_email"])
                    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                    human_delay(3, 5)
                    pwd = driver.find_element(By.CSS_SELECTOR, "input[type=password]")
                    type_human(pwd, CONFIG["indeed_password"])
                    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                    human_delay(4, 6)
                    check_and_handle_captcha(driver)
                    save_cookies(driver, "indeed")
                    logged_in = True
                    log.info("Indeed: ✅ Logged in via credentials")
                except Exception as e:
                    log.warning(f"Indeed: Credentials login issue → {e}")
            else:
                log.info("Indeed: Running with browser profile & saved clearance cookies")
                save_cookies(driver, "indeed")
                logged_in = True'''

code = code.replace(old_cred_block, new_cred_block)

# In fallback search, also call check_and_handle_captcha
old_fallback = '''                driver.get(f"https://in.indeed.com/jobs?q={query}&l={loc}&iafilter=1")
                human_delay(3, 5)'''
new_fallback = '''                driver.get(f"https://in.indeed.com/jobs?q={query}&l={loc}&iafilter=1")
                human_delay(3, 5)
                check_and_handle_captcha(driver)'''
code = code.replace(old_fallback, new_fallback)

with open('jobbot.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated Indeed and anti-Turnstile logic successfully!')
