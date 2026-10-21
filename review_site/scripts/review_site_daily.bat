@echo off
rem review.shopping-log.com daily: rebuild product_pages (price, sale end) - deploy - IndexNow - exposure probe
rem PUBLISH_WAVE = published range (1=top 5000 by reviews, 2=reviews 100+, 3=all)
setlocal
set PUBLISH_WAVE=3
set ENVFILE=D:\shopping_connect\packages\.env
set LOG=D:\shopping_connect\web_doc\review_site\daily.log
cd /d D:\shopping_connect\web_doc
echo ==== %DATE% %TIME% >> "%LOG%"
node --env-file=%ENVFILE% review_site\scripts\build_product_pages.mjs --publish-wave %PUBLISH_WAVE% >> "%LOG%" 2>&1 || goto :eof
cd /d D:\shopping_connect\web_doc\review_site
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b "CLOUDFLARE_API_TOKEN= CLOUDFLARE_ACCOUNT_ID=" "%ENVFILE%"`) do set "%%a=%%b"
call npx wrangler pages deploy --branch main --commit-dirty=true >> "%LOG%" 2>&1
node --env-file=%ENVFILE% scripts\indexnow.mjs --since %DATE:~0,4%-%DATE:~5,2%-%DATE:~8,2% >> "%LOG%" 2>&1
node --env-file=%ENVFILE% scripts\exposure_probe.mjs --n 20 >> "%LOG%" 2>&1
