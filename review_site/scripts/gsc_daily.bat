@echo off
rem review.shopping-log.com Google indexing requests (5/day, shares sc-domain quota with shopping-log 07:30 job). ASCII+CRLF only.
cd /d D:\shopping_connect\web_doc
echo ==== %DATE% %TIME% >> review_site\gsc.log
node --env-file=D:\shopping_connect\packages\.env review_site\scripts\gsc_urls.mjs --run 10 >> review_site\gsc.log 2>&1
