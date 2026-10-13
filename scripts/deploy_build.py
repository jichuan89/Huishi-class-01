#!/usr/bin/env python3
"""在服务器上脱离 SSH 会话执行前端构建，轮询结果。

原因：服务器仅 1.9GB 内存 / 2 核，构建 2700 模块时负载极高，
前台执行会随 SSH 连接抖动被连带杀死。改用 setsid + nohup 脱离会话，
构建日志与退出码落盘，再由本地轮询。
"""
import os
import sys
import time

import paramiko

import os

HOST = os.environ.get('SSH_HOST', '64.90.3.51')
USER = os.environ.get('SSH_USER', 'root')
PASS = os.environ.get('SSH_PASS', '')
if not PASS:
    sys.exit('请先设置环境变量 SSH_PASS（不建议再在服务器上构建，优先用 deploy_push_dist.py）')
APP_DIR = '/www/wwwroot/shuzhi'
LOG = '/tmp/shuzhi_build.log'
DONE = '/tmp/shuzhi_build.done'


def connect(retries=8):
    last = None
    for i in range(retries):
        try:
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(HOST, username=USER, password=PASS, timeout=30,
                      banner_timeout=60, auth_timeout=30)
            print(f'[SSH 连接成功] 第 {i + 1}/{retries} 次尝试')
            return c
        except Exception as e:
            last = e
            print(f'[重试 {i + 1}/{retries}] {type(e).__name__}: {e}')
            time.sleep(15)
    sys.exit(f'[失败] 无法连接服务器: {last}')


def run(c, cmd, timeout=300):
    _, out, _ = c.exec_command(cmd, get_pty=True, timeout=timeout)
    return out.read().decode('utf-8', 'replace')


# 1) 清理上次残留 + 启动脱离会话的构建
LAUNCH = f'''
cd {APP_DIR}
rm -f {DONE} {LOG}
# 限制 V8 堆上限，配合 swap 避免被 OOM 直接杀死
export NODE_OPTIONS="--max-old-space-size=1400"
setsid nohup bash -c 'cd {APP_DIR} && NODE_OPTIONS="--max-old-space-size=1400" npm run build > {LOG} 2>&1; echo $? > {DONE}' </dev/null >/dev/null 2>&1 &
echo "构建已启动 pid=$!"
sleep 5
echo '--- 初始日志 ---'
tail -5 {LOG} 2>/dev/null || echo '(日志尚未生成)'
'''

c = connect()
print(run(c, LAUNCH))
c.close()

# 2) 轮询构建结果
print('\n=== 轮询构建状态 ===')
started = time.time()
last_report = 0
while True:
    time.sleep(20)
    try:
        c = connect(retries=4)
        state = run(c, f'''
        if [ -f {DONE} ]; then
          echo "DONE=$(cat {DONE})"
        else
          echo "DONE=RUNNING"
        fi
        echo '--- 日志尾部 ---'
        tail -6 {LOG} 2>/dev/null || echo '(无日志)'
        echo '--- 负载/内存 ---'
        uptime
        free -h | head -2
        ''', timeout=120)
        c.close()
    except Exception as e:
        print(f'[轮询时连接失败，忽略重试] {type(e).__name__}')
        continue

    print(f'\n----- 第 {int((time.time() - started) // 20)} 次轮询 -----')
    print(state.rstrip())

    if 'DONE=RUNNING' not in state:
        code = state.split('DONE=')[1].split('\n')[0].strip()
        print(f'\n[构建结束] 退出码 = {code}')
        if code == '0':
            print('\n--- 构建产物 ---')
            c = connect(retries=4)
            print(run(c, f'''cd {APP_DIR}
ls -la dist/assets/ | grep -E 'index-.*\\.(js|css)'
stat -c 'dist/index.html mtime=%y' dist/index.html
'''))
            c.close()
        sys.exit(0 if code == '0' else 1)

    if time.time() - started > 1500:
        sys.exit('[超时] 构建超过 25 分钟仍未结束，需人工介入')