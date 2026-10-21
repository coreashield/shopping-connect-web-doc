@echo off
rem review.shopping-log.com Naver Search Advisor crawl requests, 50/day via Aside owner session. Runs after live 02:00 SA task.
cd /d D:\shopping_connect\web_doc
echo ==== %DATE% %TIME% >> review_site\sa_crawl.log
node --env-file=D:\shopping_connect\packages\.env review_site\scripts\sa_crawl_request.mjs >> review_site\sa_crawl.log 2>&1
