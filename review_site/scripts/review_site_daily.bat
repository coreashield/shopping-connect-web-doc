@echo off
rem review.shopping-log.com 매일 갱신: 판매중 상품 → product_pages 재생성(가격·판매종료 반영) → 분류 데이터 배포 → IndexNow
rem 공개 범위(물결)는 PUBLISH_WAVE 로. 다음 물결은 판정 후 숫자만 올린다.
setlocal
set PUBLISH_WAVE=2
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
