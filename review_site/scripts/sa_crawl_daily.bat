@echo off
rem review.shopping-log.com 네이버 수집 요청 하루 50 (Aside 대표 세션). 라이브 02:00 SA 작업 뒤에 돈다.
cd /d D:\shopping_connect\web_doc
echo ==== %DATE% %TIME% >> review_site\sa_crawl.log
node --env-file=D:\shopping_connect\packages\.env review_site\scripts\sa_crawl_request.mjs >> review_site\sa_crawl.log 2>&1
