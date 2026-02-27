#!/bin/bash
cd /home/c0bw3b/Sizland/multisig/docs
killall -9 pdflatex 2>/dev/null
sleep 1
rm -f dfd.aux dfd.log dfd.out dfd.toc
timeout 60 pdflatex -interaction=nonstopmode dfd.tex > /tmp/dfd_compile.log 2>&1
EXIT=$?
echo "EXIT CODE: $EXIT"
tail -10 /tmp/dfd_compile.log
ls -la dfd.pdf 2>/dev/null || echo "NO PDF GENERATED"
