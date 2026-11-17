with open('jobbot.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Update title and company extraction and apply button
old_block = """                    title, company = "Unknown", "Unknown"
                    try:
                        title   = driver.find_element(By.CSS_SELECTOR, ".jobsearch-JobInfoHeader-title span, h1.jobsearch-JobInfoHeader-title").text
                        company = driver.find_element(By.CSS_SELECTOR, "[data-company-name], .jobsearch-CompanyInfoContainer").text
                    except Exception:
                        pass

                    job_id = ""
                    if "vjk=" in driver.current_url:
                        job_id = driver.current_url.split("vjk=")[-1].split("&")[0]
                    if not job_id:
                        job_id = f"indeed_{title}_{company}".replace(" ", "_")

                    if job_id in applied_jobs:
                        continue

                    apply_btn = None
                    for sel in ["#indeedApplyButton", ".indeed-apply-button", "[data-indeed-apply-jobkey]"]:
                        try:
                            apply_btn = driver.find_element(By.CSS_SELECTOR, sel)
                            break
                        except Exception:
                            pass"""

new_block = """                    title, company = "Unknown", "Unknown"
                    try:
                        title = card.find_element(By.CSS_SELECTOR, "h2.jobTitle, a[data-jk] span, .jobTitle span").text.strip()
                    except Exception:
                        try:
                            title = driver.find_element(By.CSS_SELECTOR, "h1, h2[class*='jobsearch-JobInfoHeader-title'], [data-testid='jobsearch-JobInfoHeader-title'], .jobsearch-JobInfoHeader-title span").text.strip()
                        except Exception:
                            pass

                    try:
                        company = card.find_element(By.CSS_SELECTOR, "[data-testid='company-name'], .companyName, .css-1h7uxdj").text.strip()
                    except Exception:
                        try:
                            company = driver.find_element(By.CSS_SELECTOR, "[data-testid='inlineHeader-companyName'], [data-company-name], .jobsearch-CompanyInfoContainer").text.strip()
                        except Exception:
                            pass

                    job_id = ""
                    if "vjk=" in driver.current_url:
                        job_id = driver.current_url.split("vjk=")[-1].split("&")[0]
                    if not job_id:
                        job_id = f"indeed_{title}_{company}".replace(" ", "_")

                    if job_id in applied_jobs:
                        continue

                    apply_btn = None
                    for sel in [
                        "#indeedApplyButton",
                        "[data-testid='indeedApplyButton']",
                        "button[id*='indeedApplyButton']",
                        ".indeed-apply-button",
                        "[data-indeed-apply-jobkey]",
                        "button[aria-label*='Apply on company site']",
                        "button[aria-label*='Apply now']",
                        "button[id*='apply']"
                    ]:
                        try:
                            apply_btn = driver.find_element(By.CSS_SELECTOR, sel)
                            break
                        except Exception:
                            pass"""

content = "".join(lines)
content = content.replace(old_block, new_block, 1)

with open('jobbot.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied modern Indeed selectors successfully!")
