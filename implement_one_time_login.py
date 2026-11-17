with open('jobbot.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

old_login_block = """        logged_in = False
        log.info("Indeed: Login check kar raha hoon...")
        try:
            driver.get("https://in.indeed.com/")
            human_delay(4, 6)
        except Exception:
            pass

        # Check if logged in via profile
        try:
            driver.find_element(By.CSS_SELECTOR, ".gnav-LoggedInSection, [data-testid='header-user-menu'], .user-account-nav")
            logged_in = True
            log.info("Indeed: ? Already logged in via browser profile!")
        except Exception:
            pass

        if not logged_in:
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
                log.info("Indeed: ? Logged in via credentials")
            except Exception as e:
                log.warning(f"Indeed: Login issue ? {e}")
                time.sleep(CONFIG["manual_login_wait"])
                logged_in = True  # Continue anyway, some pages work without login"""

new_login_block = """        # 1. Check if saved cookies exist from previous 1-time login
        cookie_loaded = load_cookies(driver, "indeed", "https://in.indeed.com")
        if cookie_loaded:
            log.info("Indeed: 🍪 Loaded saved session cookies")
            driver.get("https://in.indeed.com/")
            time.sleep(2)

        # 2. Verify if currently logged in
        logged_in = False
        try:
            driver.find_element(
                By.CSS_SELECTOR,
                ".gnav-LoggedInSection, [data-testid='header-user-menu'], .user-account-nav, a[href*='account'], button[id*='user-avatar']"
            )
            logged_in = True
            log.info("Indeed: ✅ Already logged in via active session/cookies!")
        except Exception:
            pass

        # 3. First-Time Approval: Open login and give user 90s to sign in once
        if not logged_in:
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
                    save_cookies(driver, "indeed")
                    logged_in = True
                    log.info("Indeed: ✅ Logged in via manual credentials")
                except Exception as e:
                    log.warning(f"Indeed: Credentials login issue -> {e}")

            if not logged_in:
                try:
                    import winsound
                    winsound.Beep(1000, 500)
                except Exception:
                    pass

                log.info("\\n" + "="*60)
                log.info("🔑 ONE-TIME LOGIN SETUP REQUIRED")
                log.info("👉 Please sign in to Indeed in the open Chrome window (Google / Email).")
                log.info("⏳ Bot will wait up to 120s for you to complete sign-in (window will STAY OPEN)...")
                log.info("="*60 + "\\n")

                driver.get("https://secure.indeed.com/auth")
                check_and_handle_captcha(driver, wait_seconds=30)

                # Wait loop for user to sign in
                login_wait_start = time.time()
                while time.time() - login_wait_start < 120:
                    time.sleep(2)
                    try:
                        current_url = driver.current_url.lower()
                        has_user_badge = bool(driver.find_elements(
                            By.CSS_SELECTOR,
                            ".gnav-LoggedInSection, [data-testid='header-user-menu'], .user-account-nav, a[href*='account'], button[id*='user-avatar']"
                        ))
                        # If user badge is present or redirected back from /auth to jobs/home
                        if has_user_badge or ("/auth" not in current_url and "/login" not in current_url and "indeed.com" in current_url and "challenge" not in current_url):
                            logged_in = True
                            log.info("🎉 ONE-TIME LOGIN CONFIRMED! Saving session cookies permanently to disk...")
                            save_cookies(driver, "indeed")
                            time.sleep(2)
                            break
                    except Exception:
                        pass

                if not logged_in:
                    log.warning("⚠️ Login wait period finished — saving whatever session state exists...")
                    save_cookies(driver, "indeed")"""

content = "".join(lines)
# We match loosely by checking lines
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'logged_in = False' in line and i > 1080 and i < 1110:
        start_idx = i
    if 'query = CONFIG["job_title"].replace' in line and i > 1110 and i < 1150:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    print(f"Found login block from line {start_idx+1} to {end_idx+1}")
    new_lines = lines[:start_idx] + [new_login_block + "\n\n"] + lines[end_idx:]
    with open('jobbot.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("One-time login logic successfully integrated!")
else:
    print(f"Could not find indices: start={start_idx}, end={end_idx}")
