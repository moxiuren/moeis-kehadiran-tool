#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MOEIS Kehadiran 纯 HTTP 命令行客户端
功能：
1. 从 ~/.agent-secrets/secrets.env 读取教师账号凭证
2. 模拟 idMe 登录 & SSO 跳转
3. 查询今日/指定日期的班级考勤名单 (ajaxloadkehadiranharian)
4. 一键提交点名 (全勤或指定原因缺勤) 至 kemaskiniKehadiranHarian (默认安全 Dry-Run)
"""

import sys
import os
import re
import requests
import argparse
from bs4 import BeautifulSoup

def load_credentials():
    SECRETS_PATH = os.path.expanduser("~/.agent-secrets/secrets.env")
    creds = {}
    if os.path.exists(SECRETS_PATH):
        with open(SECRETS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("export "):
                    line = line[7:].strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    v = v.strip().strip('"').strip("'")
                    creds[k.strip()] = v
    return creds

def flatten_jquery_data(data, parent_key=''):
    """
    将嵌套的 Python 列表/字典扁平化为 jQuery $.param 样式的 x-www-form-urlencoded 键值对
    例如：{'rekod': [{'id': 1}]} -> {'rekod[0][id]': 1}
    """
    items = []
    if isinstance(data, dict):
        for k, v in data.items():
            new_key = f"{parent_key}[{k}]" if parent_key else k
            items.extend(flatten_jquery_data(v, new_key).items())
    elif isinstance(data, list):
        for i, v in enumerate(data):
            new_key = f"{parent_key}[{i}]"
            items.extend(flatten_jquery_data(v, new_key).items())
    else:
        items.append((parent_key, data))
    return dict(items)

class MoeisClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        })
        self.class_id = None
        self.csrf_token = None
        self.current_date = None
        self.students = []
        self.last_html = ""

    def login(self, ic, password):
        print("🔑 正在进行 idMe 统一身份认证...")
        # Step 1: 获取初始 _token
        r = self.session.get("https://idme.moe.gov.my/login", timeout=20)
        soup = BeautifulSoup(r.text, 'html.parser')
        _token = soup.find('form').find('input', {'name': '_token'})['value']

        # Step 1 Post
        r2 = self.session.post(
            "https://idme.moe.gov.my/daftarawam/semakanverification", 
            data={'_token': _token, 'ic': ic}, 
            timeout=20
        )
        _token2 = BeautifulSoup(r2.text, 'html.parser').find('form').find('input', {'name': '_token'})['value']

        # Step 2 Post (密码 + 安全确认勾选)
        r3 = self.session.post(
            "https://idme.moe.gov.my/login", 
            data={'_token': _token2, 'check': '2', 'ic': ic, 'password': password}, 
            timeout=20
        )
        if r3.status_code != 200 or "login" in r3.url and "loginverification" not in r3.url:
            print("❌ idMe 登录失败，请核对账号密码！")
            return False

        print("🟢 idMe 登录成功，正在获取应用重定向链接...")
        r4 = self.session.get("https://idme.moe.gov.my/list_aplikasi", timeout=20)
        soup4 = BeautifulSoup(r4.text, 'html.parser')
        moeispel_links = [l.get('href') for l in soup4.find_all('a') if 'moeispel' in l.get('href','')]
        if not moeispel_links:
            print("❌ 错误：在应用列表中未找到 moeispel 点名系统链接！")
            return False
        
        sso_url = moeispel_links[0]
        print(f"🔗 执行 SSO 单点登录跳转: {sso_url[:60]}...")
        self.session.get(sso_url, timeout=20)
        return True

    def init_metadata(self):
        print("📋 正在抓取点名主页的元数据 (CSRF Token, 班级 ID)...")
        TAB_URL = "https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru"
        r = self.session.get(TAB_URL, timeout=20)
        self.last_html = r.text
        soup = BeautifulSoup(r.text, 'html.parser')

        # 1. 提取 CSRF Token
        csrf = None
        meta = soup.find('meta', {'name': 'csrf-token'})
        if meta:
            csrf = meta.get('content')
        else:
            token_input = soup.find('input', {'name': '_token'})
            if token_input:
                csrf = token_input.get('value')
            else:
                m = re.search(r"_token\s*:\s*['\"]([^'\"]+)['\"]", r.text)
                if m:
                    csrf = m.group(1)
        self.csrf_token = csrf

        # 2. 提取 Class ID
        class_el = soup.find(id='txtNamakelas')
        class_val = None
        if class_el:
            if class_el.name == 'select':
                selected_opt = class_el.find('option', selected=True)
                class_val = selected_opt.get('value') if selected_opt else class_el.get('value')
            else:
                class_val = class_el.get('value')
        if not class_val:
            hidden_input = soup.find('input', {'name': 'txtNamakelas'})
            if hidden_input:
                class_val = hidden_input.get('value')
        self.class_id = class_val

        # 3. 提取当前日期
        date_el = soup.find('input', {'id': 'tkh_HH'})
        self.current_date = date_el.get('value') if date_el else None

        print(f"   [元数据] 班级 ID: {self.class_id} | 当前日期: {self.current_date} | CSRF Token: {self.csrf_token[:15]}...")
        return bool(self.class_id and self.csrf_token)

    def fetch_students(self, date_str=None):
        if not date_str:
            date_str = self.current_date
        
        print(f"🔍 正在加载日期 {date_str} 的学生名单...")
        ajax_url = "https://moeispel.moe.gov.my/sahsiah/kehadiran/ajaxloadkehadiranharian"
        payload = {
            '_token': self.csrf_token,
            'id_profile_kelas': self.class_id,
            'tarikhpilihan': date_str,
            'draw': '1',
            'start': '0',
            'length': '100',
            'search[value]': '',
            'search[regex]': 'false'
        }
        r = self.session.post(ajax_url, data=payload, timeout=20)
        if r.status_code != 200:
            print(f"❌ 名单请求失败 (HTTP {r.status_code})")
            return []
        
        try:
            res = r.json()
            raw_students = res.get('data', [])
            self.students = []
            for rs in raw_students:
                laporan = rs.get('laporan_takhadir', [])
                absent_details = None
                if len(laporan) > 0:
                    th = laporan[0].get('thadir', {})
                    absent_details = {
                        'kategori': th.get('id_kat_thadir'),
                        'sebab': th.get('id_sebab_thadir')
                    }
                self.students.append({
                    'idpelajar': rs.get('id_individu'),
                    'namamurid': rs.get('namamurid'),
                    'absent_details': absent_details  # None 代表出席
                })
            return self.students
        except Exception as e:
            print(f"❌ 解析学生 JSON 失败: {e}")
            return []

    def commit_attendance(self, absent_list, mode='simpansah', dry_run=True, date_str=None):
        """
         absent_list: 缺席学生定义列表，格式如 [{'idpelajar': 'xxx', 'namamurid': 'xxx', 'kategori': 'D', 'sebab': 'D001'}]
         mode: 'simpansah' (保存并确认) 或 'simpan' (仅保存)
        """
        if not date_str:
            date_str = self.current_date

        print(f"📤 准备提交点名数据 (日期: {date_str}, 模式: {mode})...")
        print(f"   全班人数: {len(self.students)} | 缺勤人数: {len(absent_list)}")
        for idx, item in enumerate(absent_list):
            print(f"     缺勤 [{idx+1}]: {item['namamurid']} (类别: {item['kategori']}, 原因: {item['sebab']})")
        
        submit_url = "https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru/kemaskiniKehadiranHarian"
        
        # 嵌套结构 payload
        payload = {
            '_token': self.csrf_token,
            'rekodtidakhadir': absent_list,
            'tarikh': date_str,
            'kelas': self.class_id,
            'statussimpan': mode
        }
        
        # 转换并扁平化为 jQuery 兼容的 form data
        flattened_payload = flatten_jquery_data(payload)
        
        if dry_run:
            print("⚠️ [DRY-RUN] 当前为演练模式，未向服务器发送实际提交请求。")
            print("   扁平化后的 POST 表单数据结构预览:")
            for k, v in list(flattened_payload.items())[:15]:
                print(f"     {k} => {v}")
            if len(flattened_payload) > 15:
                print(f"     ...共 {len(flattened_payload)} 项数据")
            return True

        print("⚡ 发送真实 POST 提交数据...")
        r = self.session.post(submit_url, data=flattened_payload, timeout=20)
        if r.status_code != 200:
            print(f"❌ 提交失败 (HTTP {r.status_code})")
            return False
        
        try:
            res = r.json()
            # 正常返回格式包含 bilhadir / biltidakhadir 等
            print("✅ 提交成功！服务器返回结果：")
            print(f"   已到人数: {res.get('bilhadir')}")
            print(f"   缺席人数: {res.get('biltidakhadir')}")
            return True
        except Exception as e:
            print(f"❌ 提交解析失败 (可能是未授权或服务器内部错误): {e}")
            print(f"   原始响应: {r.text[:300]}")
            return False

def main():
    parser = argparse.ArgumentParser(description="MOEIS Kehadiran HTTP Client")
    parser.add_argument('action', choices=['list', 'submit'], help="执行的操作: list(查询) / submit(提交点名)")
    parser.add_argument('--date', help="点名日期 (格式如 11/08/2026)，默认当天")
    parser.add_argument('--absent', nargs='*', help="指定缺勤学生 (格式为 '学生姓名/ID:Kategori:Sebab'，多个用空格分开)，如：'LEE ZI QING:D:D0010075'")
    parser.add_argument('--save-only', action='store_true', help="提交时仅保存不确认 (默认保存并确认)")
    parser.add_argument('--commit', action='store_true', help="确认提交到生产系统 (默认 Dry-Run 演练，不发送真实写请求)")
    
    args = parser.parse_args()
    
    creds = load_credentials()
    ic = creds.get("MOEIS_IDME_IC")
    pw = creds.get("MOEIS_IDME_PW")
    
    if not ic or not pw:
        print("❌ 错误：在 ~/.agent-secrets/secrets.env 中未找到 MOEIS_IDME_IC 或 MOEIS_IDME_PW 凭证！")
        sys.exit(1)
        
    client = MoeisClient()
    if not client.login(ic, pw):
        sys.exit(1)
        
    if not client.init_metadata():
        sys.exit(1)
        
    target_date = args.date or client.current_date
    students = client.fetch_students(target_date)
    if not students:
        print("❌ 名单为空，操作终止。")
        sys.exit(1)
        
    if args.action == 'list':
        print(f"\n📊 日期 {target_date} 学生名单考勤状态列表:")
        hadir = 0
        tak = 0
        for idx, s in enumerate(students):
            status_str = "🟢 出席"
            if s['absent_details']:
                status_str = f"🔴 缺席 (类别: {s['absent_details']['kategori']}, 原因: {s['absent_details']['sebab']})"
                tak += 1
            else:
                hadir += 1
            print(f"   [{idx+1:02d}] ID: {s['idpelajar']} | {s['namamurid']} | {status_str}")
        print(f"\n汇总：已到 {hadir} / 缺勤 {tak} / 共 {len(students)}")
        
    elif args.action == 'submit':
        # 解析缺勤参数
        absent_map = {}
        if args.absent:
            for item in args.absent:
                parts = item.split(':')
                if len(parts) != 3:
                    print(f"❌ 警告: 缺勤参数格式不正确，跳过: {item} (正确格式: '姓名或ID:Kategori:Sebab')")
                    continue
                absent_map[parts[0]] = {'kategori': parts[1], 'sebab': parts[2]}
        
        # 组装 rekodtidakhadir
        rekod_list = []
        for s in students:
            # 检查这个学生是否被指定为缺席
            # 支持通过 ID 匹配，或者通过名字（包含）匹配
            matched_key = None
            for k in absent_map:
                if k == s['idpelajar'] or k.upper() in s['namamurid'].upper():
                    matched_key = k
                    break
            
            if matched_key:
                info = absent_map[matched_key]
                rekod_list.append({
                    'idpelajar': s['idpelajar'],
                    'namamurid': s['namamurid'],
                    'kategori': info['kategori'],
                    'sebab': info['sebab']
                })
        
        mode = 'simpan' if args.save_only else 'simpansah'
        dry_run = not args.commit
        
        # 执行提交
        success = client.commit_attendance(rekod_list, mode=mode, dry_run=dry_run, date_str=target_date)
        if success:
            print("\n🎉 点名流程执行完毕！")
        else:
            sys.exit(1)

if __name__ == '__main__':
    main()
