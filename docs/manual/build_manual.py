# -*- coding: utf-8 -*-
"""레시피 기준 관리 사용자 매뉴얼(PPTX) 생성기. llm-pulse docs/manual/build_manual.py 양식을 이 앱에 맞게 고쳐 쓴다.

    python docs/manual/build_manual.py          # PPTX
    python docs/manual/build_manual.py --pdf    # PPTX + PDF (Windows PowerPoint 필요)

스크린샷은 docs/manual/capture.mjs 로 만든 shots/*.png (1280x800 CSS px, 배율 1.5) 와
말풍선 자리 shots/marks.json (CSS px 사각형) 을 쓴다. 화면은 모두 합성 데이터다.
"""
import json
import os
import subprocess
import sys

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
ASSETS = os.path.join(HERE, "assets")
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "Recipe-Golden-User-Manual-ko.pptx")
VERSION = "1.0.0"
DATE = "2026.11.22"
NAME = "레시피 기준 관리"
MARKS = json.load(open(os.path.join(SHOTS, "marks.json"), encoding="utf-8"))
DIP = (1280, 800)

# ---------------------------------------------------------------- 디자인 토큰 (llm-pulse 매뉴얼과 같음, 강조색만 앱 색)
INK = RGBColor(0x1F, 0x29, 0x37)
SUB = RGBColor(0x5B, 0x65, 0x73)
BLUE = RGBColor(0xC0, 0x00, 0x00)
NAVY = RGBColor(0x14, 0x14, 0x18)
CARD = RGBColor(0xF3, 0xF5, 0xF8)
LINE = RGBColor(0xD9, 0xDE, 0xE5)
AMBER = RGBColor(0xE5, 0xA0, 0x2D)
AMBER_BG = RGBColor(0xFF, 0xF6, 0xE5)
AMBER_TX = RGBColor(0x7A, 0x4E, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SOFT = RGBColor(0xF2, 0xB8, 0xB8)
GOLD = RGBColor(0xFF, 0xD6, 0x6B)
GREEN = RGBColor(0x1B, 0x6E, 0x20)
FONT = "맑은 고딕"
MONO = "Consolas"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
TOTAL = 23
state = {"n": 0}


def new_slide():
    state["n"] += 1
    return prs.slides.add_slide(prs.slide_layouts[6])


def box(s, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, radius=None, lw=0.75):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(lw)
    sh.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        sh.adjustments[0] = radius
    return sh


def rbox(s, x, y, w, h, fill=CARD, line=None, radius=0.03, lw=0.75):
    return box(s, x, y, w, h, fill, line, MSO_SHAPE.ROUNDED_RECTANGLE, radius, lw)


def text(s, x, y, w, h, t, size=12, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         shape=None, font=FONT, spacing=None):
    tb = shape or s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    tf.vertical_anchor = anchor
    lines = t if isinstance(t, list) else [t]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = font
    return tb


def num_circle(s, x, y, n, d=0.3, size=11):
    c = box(s, x, y, d, d, fill=BLUE, line=WHITE, shape=MSO_SHAPE.OVAL, lw=1.5)
    text(s, 0, 0, 0, 0, str(n), size, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=c)
    c.text_frame.margin_left = c.text_frame.margin_right = 0
    return c


# ---------------------------------------------------------------- 공통 틀
def header(s, section, title, bullets):
    pill = box(s, 10.2, 0.0, 2.7, 0.34, fill=BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    text(s, 0, 0, 0, 0, section, 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=pill)
    text(s, 0.45, 0.32, 11.5, 0.6, f"[레시피 기준] {title}", 28, True)
    box(s, 0.5, 1.0, 0.9, 0.06, fill=BLUE)
    for i, t in enumerate(bullets):
        box(s, 0.55, 1.37 + i * 0.36, 0.07, 0.07, fill=BLUE, shape=MSO_SHAPE.OVAL)
        text(s, 0.72, 1.24 + i * 0.36, 12.1, 0.32, t, 13.5)
    footer(s)


def footer(s):
    box(s, 0.5, 7.05, 12.33, 0.01, fill=LINE)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(0.5), Inches(7.12), Inches(0.22), Inches(0.22))
    text(s, 0.78, 7.1, 6, 0.25, f"{NAME} 사용자 매뉴얼  ·  v{VERSION}  ·  배민혁", 9, False, SUB)
    text(s, 11.8, 7.1, 1.03, 0.25, f"{state['n']} / {TOTAL}", 9, True, SUB, PP_ALIGN.RIGHT)


# ---------------------------------------------------------------- 스크린샷 카드
def load_shot(name, crop=None, dip=DIP):
    """crop: CSS px 사각형 (x0,y0,x1,y1). 반환: (경로, 크기, 오프셋)"""
    path = os.path.join(SHOTS, f"{name}.png")
    im = Image.open(path)
    k = im.width / dip[0]
    if not crop:
        return path, dip, (0, 0)
    os.makedirs(CACHE, exist_ok=True)
    x0, y0, x1, y1 = crop
    out = os.path.join(CACHE, f"{name}_{x0}_{y0}_{x1}_{y1}.png")
    im.crop((round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k))).save(out, optimize=True)
    return out, (x1 - x0, y1 - y0), (x0, y0)


def M(name, *idx):
    """marks.json 에서 말풍선 자리 고르기 (숫자 대신 사각형을 직접 줄 수도 있음)"""
    out = []
    for i in idx:
        r = MARKS[name][i] if isinstance(i, int) else i
        if r:
            out.append(tuple(r))
    return out


def shot_card(s, x, y, w, h, title, name, callouts=(), crop=None, dip=DIP, d=0.24):
    rbox(s, x, y, w, h)
    text(s, x + 0.15, y + 0.1, w - 0.3, 0.32, title, 13, True)
    path, (dw, dh), (ox, oy) = load_shot(name, crop, dip)
    bw, bh = w - 0.4, h - 0.82  # 아래 0.2in 는 "합성 데이터" 표기 자리
    k = min(bw / dw, bh / dh)
    iw, ih = dw * k, dh * k
    ix, iy = x + (w - iw) / 2, y + 0.5
    box(s, ix - 0.02, iy - 0.02, iw + 0.04, ih + 0.04, fill=WHITE, line=LINE)
    s.shapes.add_picture(path, Inches(ix), Inches(iy), Inches(iw), Inches(ih))
    for n, r in enumerate(callouts, 1):
        x0, y0, x1, y1 = r
        x0, y0, x1, y1 = max(x0, ox), max(y0, oy), min(x1, ox + dw), min(y1, oy + dh)
        box(s, ix + (x0 - ox) * k, iy + (y0 - oy) * k, max(0.05, (x1 - x0) * k), max(0.05, (y1 - y0) * k), fill=None, line=BLUE,
            shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, lw=1.75)
        c = box(s, ix + (x0 - ox) * k - d / 2, iy + (y0 - oy) * k - d / 2, d, d, fill=BLUE, line=WHITE,
                shape=MSO_SHAPE.OVAL, lw=1.25)
        text(s, 0, 0, 0, 0, str(n), 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=c)
        c.text_frame.margin_left = c.text_frame.margin_right = 0
    text(s, x + w - 3.0, y + h - 0.27, 2.85, 0.22, "※ 합성 데이터로 찍은 화면", 8.5, False, SUB, PP_ALIGN.RIGHT)


def steps_card(s, x, y, w, h, steps, title="사용 순서", tip=None, desc_size=10):
    rbox(s, x, y, w, h)
    text(s, x + 0.15, y + 0.1, w - 0.3, 0.32, title, 13, True)
    n = len(steps)
    top = y + 0.52
    avail = h - 0.52 - (0.62 if tip else 0.15)
    pitch = min(0.8, avail / n)
    for i, (hd, ds) in enumerate(steps):
        yy = top + i * pitch
        num_circle(s, x + 0.2, yy + 0.03, i + 1)
        text(s, x + 0.62, yy - 0.02, w - 0.8, 0.28, hd, 12, True)
        text(s, x + 0.62, yy + 0.24, w - 0.8, pitch - 0.22, ds, desc_size, False, SUB)
    if tip:
        t = rbox(s, x + 0.15, y + h - 0.55, w - 0.3, 0.42, fill=AMBER_BG, line=AMBER, radius=0.15)
        text(s, 0, 0, 0, 0, "Tip  " + tip, 9.5, False, AMBER_TX, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, shape=t)
        t.text_frame.margin_left = Inches(0.12)


CY, CH = 2.45, 4.5      # 카드 영역
LX, LW = 0.5, 7.0       # 왼쪽(스크린샷) 카드
RX, RW = 7.65, 5.18     # 오른쪽(순서) 카드


def shot_steps(section, title, bullets, shot, callouts, steps, tip=None, card_title=None, crop=None, desc_size=10):
    s = new_slide()
    header(s, section, title, bullets)
    shot_card(s, LX, CY, LW, CH, card_title or title, shot, callouts, crop)
    steps_card(s, RX, CY, RW, CH, steps, tip=tip, desc_size=desc_size)
    return s


def grid(s, x0, y0, w, h, dark=True):
    """표지용 그림: 장비(행) × 버전(열) 칸. 기준 열은 금색 마름모, 지금 쓰는 버전은 점"""
    cols, rows = 10, 3
    cw, rh = w / cols, h / rows
    cur = {0: 7, 1: 7, 2: 6}
    for r in range(rows):
        for c in range(cols):
            fill = RGBColor(0x22, 0x22, 0x28) if dark else CARD
            if c == 7:
                fill = RGBColor(0x33, 0x1E, 0x1E)
            box(s, x0 + c * cw + 0.03, y0 + r * rh + 0.03, cw - 0.06, rh - 0.06, fill=fill)
            d = 0.16
            if cur[r] == c:
                box(s, x0 + c * cw + cw / 2 - d / 2, y0 + r * rh + rh / 2 - d / 2, d, d, fill=BLUE if r == 2 else RGBColor(0x7F, 0xD4, 0x83), shape=MSO_SHAPE.OVAL)
            elif c in (3, 5) or (r == 1 and c == 6):
                box(s, x0 + c * cw + cw / 2 - d / 2, y0 + r * rh + rh / 2 - d / 2, d, d, fill=None, line=RGBColor(0x8A, 0x8A, 0x96), shape=MSO_SHAPE.OVAL, lw=1.25)
    box(s, x0 + 7 * cw + cw / 2 - 0.13, y0 - 0.34, 0.26, 0.26, fill=GOLD, shape=MSO_SHAPE.DIAMOND)


# ================================================================ 1. 표지
def cover():
    s = new_slide()
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY
    grid(s, 0.8, 5.6, 11.7, 1.5)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(0.8), Inches(0.9), Inches(0.9), Inches(0.9))
    text(s, 0.75, 2.0, 7, 1.0, NAME, 46, True, WHITE)
    text(s, 0.8, 3.0, 7, 0.6, "사용자 매뉴얼", 26, False, SOFT)
    box(s, 0.85, 3.75, 0.9, 0.06, fill=BLUE)
    text(s, 0.8, 3.95, 6.0, 0.9, ["레시피 파일만으로 '어느 장비가 기준과 다른가'를 보고,", "1대 시범 → 전체 배포 · 롤백 묶음을 만드는 웹 앱"], 15, False, RGBColor(0xC9, 0xD3, 0xE0))
    text(s, 0.8, 4.85, 7, 0.3, f"Version {VERSION}   ·   {DATE}   ·   배민혁", 11, False, RGBColor(0x8A, 0x97, 0xA8))
    path, _, _ = load_shot("Board")
    box(s, 6.88, 0.78, 6.0, 3.77, fill=None, line=RGBColor(0x3A, 0x3A, 0x44), lw=1.5)
    s.shapes.add_picture(path, Inches(6.9), Inches(0.8), Inches(5.96), Inches(3.725))


# ================================================================ 2. 목차
def toc():
    s = new_slide()
    pill = box(s, 10.2, 0.0, 2.7, 0.34, fill=BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    text(s, 0, 0, 0, 0, "목차", 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=pill)
    text(s, 0.45, 0.32, 11.5, 0.6, "목차", 28, True)
    box(s, 0.5, 1.0, 0.9, 0.06, fill=BLUE)
    text(s, 0.55, 1.2, 12, 0.35, "처음 쓰는 분은 1~2번, 필요한 화면만 찾는 분은 오른쪽 쪽수를 보세요.", 13.5, False, SUB)
    groups = [
        ("1", "시작하기", [("3", "이 앱이 푸는 문제"), ("4", "설치와 첫 실행"), ("5", "화면 구성")]),
        ("2", "화면별 사용법", [("6", "장비 × 버전 현황판"), ("7", "Diff"), ("8", "기준 · 허용 오차"), ("9", "검사 전 검증")]),
        ("3", "현장 검증 절차", [("10", "4단계 한눈에"), ("11", "재현"), ("12", "비교"), ("13", "Shadow (1대 시범)"), ("14–16", "전환 · 묶음 · 롤백")]),
        ("4", "내 데이터 · 개인정보", [("17", "이력"), ("18", "읽을 수 있는 형식"), ("19", "읽지 못한 줄 · 오류 메시지"), ("20", "데이터 · 개인정보 (LLM 없음)")]),
        ("5", "부록", [("21", "영어 · 다크 · 모바일 · 키보드"), ("22", "FAQ · 문제 해결"), ("23", "버전 정보")]),
    ]
    pos = [(0.5, 1.9, 3.95, 2.45), (4.69, 1.9, 3.95, 2.45), (8.88, 1.9, 3.95, 2.45),
           (0.5, 4.5, 6.05, 2.4), (6.78, 4.5, 6.05, 2.4)]
    for (no, name, items), (x, y, w, h) in zip(groups, pos):
        rbox(s, x, y, w, h)
        num_circle(s, x + 0.2, y + 0.2, no, 0.38, 13)
        text(s, x + 0.7, y + 0.2, w - 0.9, 0.4, name, 16, True, anchor=MSO_ANCHOR.MIDDLE)
        for i, (pg, nm) in enumerate(items):
            yy = y + 0.74 + i * 0.32
            text(s, x + 0.3, yy, 0.9, 0.3, pg, 11.5, True, BLUE)
            text(s, x + 1.2, yy, w - 1.4, 0.3, nm, 11.5, False, INK)
    footer(s)


# ================================================================ 3. 소개
def intro():
    s = new_slide()
    header(s, "시작하기", "이 앱이 푸는 문제", [
        "관점: 장비 쪽 엔지니어가 보는 기준 관리 — SECS/GEM · MES 연동 없이 레시피 파일만으로 본다",
        "질문 두 가지: 어느 장비가 기준과 다른가, 무엇이 언제 바뀌었나",
        "서버 · 에이전트 없이 브라우저에서 동작하고, 파일은 이 기기 밖으로 나가지 않는다",
    ])
    cards = [
        ("파일만으로", "JSON · INI · XML · CSV · key=value 를 같은 파라미터 트리로 읽습니다. 형식이 달라도 같은 버전이면 같은 버전으로 식별합니다."),
        ("허용 오차 · 단위", "±값 · ±% 허용 오차, 1.5 ms = 1500 us 같은 단위 환산, 무시 항목을 반영해 통과 / 차단과 사유를 냅니다."),
        ("1대 시범 → 전체", "후보 기준을 1대에서 먼저 쓰고(Shadow), 조건을 채우면 전환합니다. 롤백 묶음은 전환할 때 같이 만들어집니다."),
    ]
    for i, (hd, ds) in enumerate(cards):
        x = 0.5 + i * 4.19
        rbox(s, x, 2.45, 3.95, 1.95)
        num_circle(s, x + 0.2, 2.65, i + 1, 0.36)
        text(s, x + 0.68, 2.64, 3.1, 0.38, hd, 15, True, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.25, 3.18, 3.5, 1.1, ds, 11, False, SUB)
    text(s, 0.5, 4.62, 6, 0.3, "파일이 판단이 되기까지", 13, True)
    flow = [
        ("가져오기", ["버전 · 장비 현재 파일", "폴더 · 감시"]),
        ("기준 · Diff", ["허용 오차 · 단위", "무시 항목"]),
        ("현황판 · 검증", ["장비 × 버전", "검사 전 통과 / 차단"]),
        ("변경 · 롤백", ["비교 → 1대 시범", "전환 · 롤백 묶음"]),
    ]
    w, gap = 2.78, 0.4
    for i, (hd, ln) in enumerate(flow):
        x = 0.5 + i * (w + gap)
        hl = i == 3
        rbox(s, x, 5.0, w, 1.75, fill=WHITE if hl else CARD, line=BLUE if hl else None, radius=0.04, lw=2)
        text(s, x + 0.1, 5.1, w - 0.2, 0.4, hd, 14, True, BLUE if hl else INK, PP_ALIGN.CENTER)
        text(s, x + 0.1, 5.6, w - 0.2, 1.0, ln, 10.5, False, SUB, PP_ALIGN.CENTER)
        if i < 3:
            box(s, x + w + 0.06, 5.72, gap - 0.12, 0.34, fill=BLUE, shape=MSO_SHAPE.RIGHT_ARROW)


# ================================================================ 4. 설치
def install():
    s = new_slide()
    header(s, "시작하기", "설치와 첫 실행", [
        "정적 파일만 있는 웹 앱. 브라우저의 '앱 설치'로 PWA 로 설치하면 오프라인에서도 열림",
        "처음 열면 안내 창과 합성 예시 세트(레시피 1개 · 항목 40 · 버전 10 · 장비 3대)가 함께 열림",
        "서버가 없으므로 계정 · 로그인이 없음. 데이터는 이 브라우저(IndexedDB)에만 저장",
    ])
    steps_card(s, 0.5, CY, 6.0, CH, [
        ("주소 열기", "Chrome · Edge · Firefox 최신판에서 앱 주소를 엽니다."),
        ("앱 설치 (선택)", "주소창 오른쪽 '앱 설치' 아이콘 → 설치. 시작 메뉴 · 바탕 화면에서 창으로 열립니다."),
        ("첫 실행 안내", "예시 세트 · 내 레시피 · 기준 변경 순서 3가지를 안내합니다. [시작하기]로 닫습니다."),
        ("내 PC 에서 직접 실행", "저장소 폴더에서  python -m http.server 8734 --bind 127.0.0.1  → http://127.0.0.1:8734/"),
    ], title="설치 순서", tip="새 버전이 나오면 화면 아래에 '새로고침' 안내가 뜹니다", desc_size=10.5)
    shot_card(s, 6.75, CY, 6.08, CH, "첫 실행 안내", "Onboard", crop=(300, 160, 980, 640))


# ================================================================ 본문
def screens():
    shot_steps("시작하기", "화면 구성", [
        "오른쪽 위: 레시피 고르기 · 언어(한국어 · English) · 테마 · 도움말 · 설정",
        "위에서 아래로: 가져오기 → 현황판 → 기준 · 검사 전 검증 → Diff → 현장 검증 절차 → 이력",
        "모든 화면이 한 페이지. 버튼을 누르면 해당 패널로 스크롤",
    ], "Home", M("Home", 0, 5, 6, 7, 8, 9), [
        ("레시피", "가져온 레시피가 여러 개면 여기서 고릅니다"),
        ("예시 세트 (합성)", "가상의 레시피 DEMO-SCAN 과 장비 EQ-01~03"),
        ("레시피 파일 열기", "여러 파일을 한 번에. 끌어다 놓아도 됩니다"),
        ("폴더 가져오기", "하위 폴더 이름 = 장비, versions 폴더 = 버전"),
        ("폴더 연결 (변경 감시)", "Chrome · Edge. 5초마다 장비 파일 변경을 기록"),
        ("요약", "레시피 · 버전 수 · 장비 수 · 기준 · 차단 장비"),
    ], tip="새로고침해도 가져온 파일 · 기준 · 이력은 그대로 남습니다", card_title="첫 화면", desc_size=9.5)

    SEC = "화면별 사용법"
    shot_steps(SEC, "장비 × 버전 현황판", [
        "행 = 장비, 열 = 등록 버전. ● 지금 쓰는 버전 · ◐ 가장 가까운 버전 · ○ 예전에 썼던 버전 · ◆ 기준",
        "형식이 달라도 같은 내용이면 같은 버전으로 식별 (EQ-01 은 INI, 버전은 JSON)",
        "판정을 누르면 기준과의 Diff, 칸을 누르면 그 버전과의 Diff",
    ], "Board", M("Board", 0, 1, 2, 3, 4, 5), [
        ("현재 파일", "파일 이름 · 형식 · 가져온 시각"),
        ("버전 식별", "'v8 근처 · 차이 2' = 같은 버전은 없고 v8 과 2개 다름"),
        ("기준 대비", "통과 · 허용 오차 안 N · 차단 N"),
        ("기준 열 ◆", "후보가 있으면 ◇ 로 표시"),
        ("○ 예전 버전", "이력의 장비 파일이 그 버전과 같았던 적"),
        ("◐ 가장 가까운 버전", "로컬 수정이 있으면 빨간 반원"),
    ], card_title="현황판", crop=(0, 70, 1280, 470), desc_size=9.5)

    shot_steps(SEC, "Diff", [
        "A 와 B 는 버전 · 장비 현재 파일 · 검증한 파일 중 아무거나",
        "섹션별로 묶어 보여주고, 차단 줄이 위로. B 의 줄 번호로 파일에서 바로 찾음",
        "'기준 규칙 적용'을 끄면 허용 오차 · 무시 없이 정확히 비교",
    ], "Diff", M("Diff", 0, 1, 2, 3, 4, 5, 6), [
        ("A", "보통 기준 버전"),
        ("B", "비교할 장비 파일 또는 버전"),
        ("보기", "차이만 · 차단만 · 전체"),
        ("기준 규칙 적용", "허용 오차 · 단위 환산 · 무시 항목"),
        ("요약", "판정과 상태별 개수"),
        ("섹션", "섹션마다 항목 수 · 차단 수"),
        ("허용 오차 밖", "+4 (허용 ±2) 처럼 차이와 허용을 함께"),
    ], card_title="EQ-03 ↔ 기준 v8", desc_size=9.5)

    shot_steps(SEC, "기준 · 허용 오차", [
        "레시피마다 기준 버전 하나 + 규칙(허용 오차 · 무시 항목)",
        "허용 오차는 위에서부터 처음 맞는 규칙 하나. ±값과 ±% 가 둘 다 있으면 더 넓은 쪽",
        "기준을 바꿀 때는 바로 고치지 않고 '현장 검증 → 비교'에서 후보로 시작",
    ], "Baseline", M("Baseline", 0, 1, 2, 3), [
        ("기준 버전", "지정한 시각과 파일 이름"),
        ("허용 오차 규칙", "항목은 글롭(* ?), 대소문자 무시"),
        ("무시 항목", "저장 시각 · 저장한 사람 · 주석 등"),
        ("기준 변경 시작", "비교 탭으로 이동합니다"),
    ], tip="첫 버전을 가져오면 그 버전이 기준이 되고, 기본 무시 항목이 들어갑니다", card_title="기준 패널")

    shot_steps(SEC, "검사 전 검증", [
        "검사를 시작하기 전에 그 장비가 쓸 파일을 기준과 비교해 통과 / 차단",
        "차단 사유: 항목 · 실제 값 · 기준 값 · 허용 · 차이 · 파일의 줄 번호",
        "결과는 이력과 Shadow 기록에 남고, JSON 으로 내려받을 수 있음",
    ], "Check", M("Check", 0, 1, 2, 3, 4, 5), [
        ("장비", "어느 장비의 기준으로 볼지 (시범 장비면 후보 기준)"),
        ("검사할 파일 고르기", "장비에서 가져온 파일을 바로 검증"),
        ("장비 현재 파일로 검증", "가져온 장비 파일로 검증"),
        ("판정", "통과 — 시작해도 됨 / 차단 — 시작하지 말 것"),
        ("차단 사유", "허용 오차 밖 · 값 다름 · 빠짐 등"),
        ("결과 파일", "장비 · 파일 SHA-256 · 판정 · 사유 JSON"),
    ], card_title="EQ-03 검사 전 검증", desc_size=9.5)


def flow_overview():
    s = new_slide()
    header(s, "현장 검증 절차", "4단계 한눈에", [
        "바꾸기 전에 같은 장비 파일로 확인하고, 새 기준은 1대에서 먼저 돌려 보고, 언제든 되돌린다",
        "화면 '현장 검증 절차' 패널의 탭 4개가 이 순서를 그대로 따름 (← → 로 탭 이동)",
        "오른쪽 위 배지는 지금 상태: '진행 중인 변경 없음' · '후보 비교 중' · '1대 시범 중'",
    ])
    st = [
        ("재현", "장비 파일 상태를 세트로", ["내장 세트 2개 (합성)", "지금 상태를 이름 붙여 저장", "다시 열면 같은 상태로"]),
        ("비교", "같은 장비 파일로 판정 비교", ["후보 버전 · 규칙 편집", "현재 기준 vs 후보", "판정이 바뀌는 장비 강조"]),
        ("Shadow", "1대 시범", ["시범 장비만 후보가 판정", "나머지는 옆 칸에만", "다른 이유를 분류"]),
        ("전환 · 롤백", "조건을 채우면 전환", ["적용 확인 · 통과 N회", "놓침 위험 0", "롤백 묶음 같이 생성"]),
    ]
    w, gap = 2.85, 0.31
    for i, (hd, sub, items) in enumerate(st):
        x = 0.5 + i * (w + gap)
        rbox(s, x, 2.6, w, 3.9, fill=WHITE, line=BLUE if i == 2 else LINE, radius=0.04, lw=1.5)
        num_circle(s, x + 0.2, 2.8, i + 1, 0.42, 14)
        text(s, x + 0.75, 2.8, w - 0.9, 0.42, hd, 17, True, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.2, 3.4, w - 0.4, 0.6, sub, 11.5, True, SUB)
        for j, it in enumerate(items):
            box(s, x + 0.25, 4.22 + j * 0.55, 0.07, 0.07, fill=BLUE, shape=MSO_SHAPE.OVAL)
            text(s, x + 0.4, 4.08 + j * 0.55, w - 0.55, 0.5, it, 11)
        if i < 3:
            box(s, x + w + 0.03, 4.3, gap - 0.06, 0.3, fill=BLUE, shape=MSO_SHAPE.RIGHT_ARROW)


def verify():
    SEC = "현장 검증 절차"
    shot_steps(SEC, "① 재현", [
        "재현 세트 = 장비마다 어느 파일을 쓰고 있었는지의 묶음 (파일 내용은 이 기기에 보관)",
        "기준 · 규칙을 바꾸기 전에, 문제가 있던 그때 상태를 다시 열어 같은 조건으로 비교",
        "세트를 열면 장비 현재 파일이 그 상태로 바뀌고 이력에 남음",
    ], "Repro", M("Repro", 0, 1, 2, 3, 4), [
        ("재현 탭", "현장 검증 절차의 첫 단계"),
        ("세트 목록", "내장: 지금 상태(EQ-03 로컬 수정) · 모두 기준 v8"),
        ("열기", "장비 파일 상태를 그 세트로"),
        ("새 세트 이름", "예: 11월 Down 직전"),
        ("저장", "지금 장비 파일 상태를 세트로 저장"),
    ], card_title="재현 세트")

    shot_steps(SEC, "② 비교", [
        "후보 = 기준 버전 + 규칙. 버전 · 허용 오차 · 무시 항목을 고치면 오른쪽 비교가 바로 바뀜",
        "같은 장비 파일로 현재 기준과 후보의 판정을 나란히. 판정이 바뀌는 장비는 노란 줄",
        "'후보로 시작'을 눌러야 다음 단계(1대 시범)로 갈 수 있음",
    ], "Compare", M("Compare", 0, 1, 2, 4, 5, 6), [
        ("후보 기준 버전", "기준 다음 버전이 먼저 골라져 있습니다"),
        ("바뀌는 항목", "기준 버전과 후보 버전 사이 바뀐 파라미터"),
        ("허용 오차 규칙", "±값 · ±% · 단위. 규칙 추가 · 삭제"),
        ("같은 장비 파일로 비교", "현재 기준 판정 vs 후보 판정"),
        ("판정 바뀜", "통과 → 차단 또는 차단 → 통과"),
        ("후보로 시작", "후보가 저장되고 Shadow 탭이 열립니다"),
    ], card_title="비교: v8 vs 후보 v9", desc_size=9.5)

    shot_steps(SEC, "③ Shadow (1대 시범)", [
        "시범 장비 1대만 후보 기준으로 판정. 나머지 장비는 현재 기준이 판정하고 후보 결과는 옆 칸에만",
        "두 판정이 다르면 이유를 분류: 새 버전 파일(예상) · 새 파일 필요(예상) · 놓침 위험 · 규칙이 엄격해져 차단",
        "시범 묶음(zip)에는 후보 파일 + 시범 장비의 직전 파일 + manifest + SHA256SUMS",
    ], "Shadow", M("Shadow", 0, 1, 2, 3, 4), [
        ("시범 묶음 내려받기", "시범 장비에 복사할 zip"),
        ("시범 장비 파일 가져오기", "복사한 뒤 장비 파일을 다시 가져와 확인"),
        ("적용됨으로 기록 (수동)", "확인 없이 기록만 (현황판에 '수동 기록')"),
        ("시범 장비 검사 전 검증", "후보 기준으로 판정, 통과 횟수를 셈"),
        ("장비별 판정과 옆 칸", "결정 · Shadow · 다른 이유"),
    ], tip="시범 중에 후보 버전 · 규칙을 고치면 시범 통과 횟수를 처음부터 다시 셉니다", card_title="1대 시범 (EQ-01)", desc_size=9.5)

    shot_steps(SEC, "④ 전환 조건 · 놓침 위험", [
        "조건: 시범 시작 · 시범 장비 파일 = 후보 버전 · 검증 통과 N회(설정, 기본 3) · 시범 차단 0 · 놓침 위험 0",
        "놓침 위험 = 허용 오차를 넓히거나 무시 항목을 늘려서만 통과하게 된 장비 (지금 기준으로는 차단)",
        "의도한 변경이면 '확인했고 의도한 변경입니다'를 체크해야 전환 버튼이 켜짐",
    ], "GateLoose", M("GateLoose", 0, 1, 2), [
        ("놓침 위험", "예: 임계값 허용 ±2 → ±5 로 넓혀 EQ-03 이 통과"),
        ("확인", "검토했다는 표시. 이력에 남습니다"),
        ("전환 버튼", "조건을 모두 채우면 켜집니다"),
    ], tip="놓침 위험이 없는 정상 흐름은 조건 5개가 모두 ✓ 로 바뀝니다", card_title="전환 조건 (규칙을 넓힌 후보)", crop=(0, 70, 1280, 680))

    shot_steps(SEC, "④ 전환 · 배포 묶음", [
        "전환하면 기준이 후보로 바뀌고, 이전 기준은 기준 이력에 남음",
        "전체 배포 묶음 = 후보 파일 + 나머지 장비의 직전 파일. 롤백 묶음 = 모든 장비(시범 포함)의 변경 전 파일",
        "장비에 복사한 뒤 장비 파일을 다시 가져오거나(또는 폴더 감시) '적용됨으로 기록'",
    ], "Switched", M("Switched", 0, 1, 2, 3, 4), [
        ("전체 배포 묶음", "나머지 장비 2대에 복사할 zip"),
        ("롤백 묶음", "장비 3대의 변경 전 파일"),
        ("적용됨으로 기록", "확인 전까지는 '수동 기록'으로 표시"),
        ("기준 이력", "버전 · 기간 · 규칙 수"),
        ("롤백", "직전 기준으로 한 번에 되돌림"),
    ], card_title="전환 직후", desc_size=9.5)

    shot_steps(SEC, "④ 롤백 · 묶음 검증", [
        "롤백하면 직전 기준으로 돌아가고, 전환 때 만든 롤백 묶음을 바로 내려받을 수 있음",
        "롤백도 기준 이력에 '롤백됨'으로 남고, 필요하면 '롤백 취소'로 다시 앞으로",
        "묶음 검증: 장비 쪽에서 받은 zip 을 넣으면 manifest · SHA256SUMS 로 파일마다 확인",
    ], "Rollback", M("Rollback", 0, 1, 2, 3, 4), [
        ("롤백 안내", "롤백 묶음 · 적용 기록 버튼"),
        ("롤백됨", "되돌린 기준이 이력에 남습니다"),
        ("zip 고르기", "받은 배포 · 롤백 묶음"),
        ("검증 결과", "통과 / 실패 — 실패면 쓰지 마세요"),
        ("파일별 결과", "바뀐 파일은 기대 · 실제 SHA-256 앞부분"),
    ], tip="명령줄에서는 zip 을 푼 폴더에서  sha256sum -c SHA256SUMS", card_title="롤백 뒤 묶음 검증", desc_size=9.5)


def data():
    SEC = "내 데이터 · 개인정보"
    shot_steps(SEC, "이력", [
        "버전 등록 · 장비 파일 가져옴 / 내용 바뀜 · 검사 전 검증 · 후보 · 시범 · 전환 · 롤백 · 묶음 · 재현 세트",
        "장비 · 종류로 걸러서 '무엇이 언제 바뀌었나'를 봄. 장비 파일 내용이 바뀐 줄은 빨간 글씨",
        "최근 5,000건까지 보관 (설정 → 백업으로 내보내기)",
    ], "History", M("History", 0, 1, 2, 3), [
        ("장비", "한 장비의 이력만"),
        ("종류", "버전 · 장비 파일 · 검증 · 전환 등"),
        ("최근 이력", "가장 최근이 위"),
        ("내용 바뀜", "같은 장비의 이전 파일과 내용이 다름"),
    ], card_title="이력")

    s = new_slide()
    header(s, SEC, "읽을 수 있는 형식", [
        "형식이 달라도 같은 파라미터 경로(섹션.키)로 읽어 같은 버전으로 비교",
        "인코딩 UTF-8 · UTF-16(BOM) · EUC-KR 자동 감지. 5MB 를 넘는 파일 · 바이너리는 받지 않음",
        "값에 붙은 단위(300 mm, 1.5 ms)는 떼어 내 단위 환산에 씀",
    ])
    rows = [
        ("JSON", '{"Optics": {"Exposure": {"value": 1500, "unit": "us"}}}', "중첩 객체 → 섹션.키, {value, unit}, name 이 있는 배열"),
        ("INI", "[Optics]\nExposure=1500 us", "[섹션] 아래 키=값, ; # 주석"),
        ("XML", '<Section name="Optics">\n  <Param name="Exposure" value="1.5" unit="ms"/>', "루트 이름 제외, name · value · unit 속성 또는 요소 글자"),
        ("CSV", "section,name,value,unit\nOptics,Exposure,1500,us", "머리글 name · value (· unit · section), 없으면 1 · 2 · 3열"),
        ("key=value", "Optics.Exposure = 1.5 ms", "섹션 없이 경로 = 값 (: 도 가능)"),
    ]
    for i, (fmt, ex, note) in enumerate(rows):
        y = CY + i * 0.9
        rbox(s, 0.5, y, 12.33, 0.8)
        text(s, 0.65, y + 0.2, 1.4, 0.4, fmt, 14, True, BLUE, anchor=MSO_ANCHOR.MIDDLE)
        text(s, 2.1, y + 0.08, 5.6, 0.66, ex.split("\n"), 10, False, INK, font=MONO)
        text(s, 7.9, y + 0.2, 4.8, 0.45, note, 10.5, False, SUB, anchor=MSO_ANCHOR.MIDDLE)

    shot_steps(SEC, "읽지 못한 줄 · 오류 메시지", [
        "가져오기 창에서 파일마다 형식 · 레시피 · 등록 방식(버전 / 장비 현재 파일)을 고름",
        "읽지 못한 줄은 줄 번호와 이유. 그 줄의 항목은 '빠짐'으로 판정되어 검사 전 검증에서 차단",
        "예시는 일부 줄이 깨진 합성 XML · INI 와 그림 파일",
    ], "Import", M("Import", 0, 1, 2, 3, 4, 5, 6), [
        ("형식", "자동 감지, 틀리면 직접 고름"),
        ("레시피", "파일 안 Name 항목 또는 파일 이름"),
        ("등록 방식", "버전 · 장비 현재 파일"),
        ("장비 이름", "없으면 새 장비가 생깁니다"),
        ("XML 오류", "닫는 태그가 다름 (열린 줄 번호 함께)"),
        ("INI 오류", "'키=값' 아님 · 같은 항목 또 나옴"),
        ("글자 파일 아님", "가져오지 않습니다"),
    ], card_title="가져오기 창", desc_size=9.5)

    shot_steps(SEC, "데이터 · 개인정보 (LLM 없음)", [
        "이 앱은 LLM 을 쓰지 않음. 외부 서버 · API · 오류 수집으로 보내는 요청이 없음 (같은 주소의 앱 파일만)",
        "저장: 이 브라우저의 IndexedDB. 설정에서 JSON 백업 · 가져오기 · 전체 삭제",
        "오류는 이 기기에만 기록 (최근 200건). 사생활 보호 창에서는 메모리에만 두고 새로고침하면 사라짐",
    ], "Settings", M("Settings", 0, 1, 2, 3, 4), [
        ("시범 통과 횟수", "전환 전에 필요한 시범 장비 검증 통과 (1~50)"),
        ("백업 내보내기", "버전 · 장비 파일 · 기준 · 이력 전체 JSON"),
        ("백업 가져오기", "다른 PC · 브라우저로 옮길 때"),
        ("모두 지우기", "되돌릴 수 없습니다"),
        ("오류 기록 · 저장소", "IndexedDB 또는 메모리"),
    ], card_title="설정", desc_size=9.5)


def appendix():
    s = new_slide()
    header(s, "부록", "영어 · 다크 · 모바일 · 키보드", [
        "오른쪽 위에서 한국어 · English 를 바꾸면 화면 문구 · 차단 사유 · 이력 문장이 함께 바뀜",
        "테마 버튼으로 밝게 · 어둡게. 휴대폰 폭에서도 같은 기능 (표는 가로 스크롤)",
        "현황판 · Diff 는 모두 표라서 화면 낭독기로 읽을 수 있음",
    ])
    path, _, _ = load_shot("EnCheck")
    rbox(s, 0.5, CY, 6.6, CH)
    text(s, 0.65, CY + 0.1, 6, 0.32, "English", 13, True)
    s.shapes.add_picture(path, Inches(0.7), Inches(CY + 0.5), Inches(6.2), Inches(3.875))
    p2, _, _ = load_shot("MobileDark", dip=(390, 844))
    rbox(s, 7.3, CY, 2.3, CH)
    text(s, 7.45, CY + 0.1, 2.0, 0.32, "모바일 · 다크", 13, True)
    s.shapes.add_picture(p2, Inches(7.55), Inches(CY + 0.5), Inches(1.8), Inches(1.8 * 1266 / 585))
    rbox(s, 9.8, CY, 3.03, CH)
    text(s, 9.95, CY + 0.1, 2.8, 0.32, "키보드", 13, True)
    keys = [("Tab", "다음 버튼 · 칸"), ("Enter", "누르기 · 열기"), ("← →", "현장 검증 탭 이동"), ("Home End", "첫 · 마지막 탭"), ("Space", "체크 상자"), ("Esc", "대화상자 닫기")]
    for i, (k, d) in enumerate(keys):
        yy = CY + 0.6 + i * 0.58
        chip = rbox(s, 9.95, yy, 1.15, 0.36, fill=INK, radius=0.2)
        text(s, 0, 0, 0, 0, k, 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=chip, font=MONO)
        text(s, 11.2, yy, 1.6, 0.36, d, 10.5, False, INK, anchor=MSO_ANCHOR.MIDDLE)


def faq():
    s = new_slide()
    header(s, "부록", "FAQ · 문제 해결", [
        "대부분은 가져오기 창의 형식 · 레시피 · 등록 방식과 기준 규칙으로 해결. 도움말 창에도 같은 내용",
        "예기치 않은 오류는 설정 → 오류 기록 건수로 확인 (이 기기에만 남음)",
        "데이터 백업 · 가져오기 · 전체 삭제는 설정 → 데이터",
    ])
    qa = [
        ("같은 레시피인데 다른 레시피로 들어가요", "가져오기 창의 '레시피' 칸을 같은 이름으로 고치세요. 파일 안 Header.Name 이 있으면 그 값을 씁니다."),
        ("모든 장비가 '차단'이에요", "저장 시각 · 주석처럼 장비마다 다른 항목은 비교 탭에서 무시 항목에 넣고 후보 → 전환 순서로 바꾸세요."),
        ("단위가 맞지 않는다고 나와요", "nm · um · mm, ms · s 등은 환산합니다. 목록에 없는 단위는 글자가 같아야 같습니다."),
        ("한글이 깨져요", "UTF-8 · UTF-16 · EUC-KR 을 자동으로 고릅니다. 그 밖의 인코딩은 UTF-8 로 저장해 다시 가져오세요."),
        ("앱이 장비에 파일을 써 주나요?", "아니요. 묶음을 사람이 복사하고, 장비 파일을 다시 가져오거나 폴더 감시로 적용을 확인합니다."),
        ("전환 버튼이 안 켜져요", "전환 조건의 ✗ 항목을 보세요. 시범 장비 파일이 후보와 같아야 하고, 검증 통과 횟수를 채워야 합니다."),
        ("폴더 감시가 안 보여요", "Chrome · Edge 의 기능입니다. 새로고침하면 다시 연결해야 합니다."),
        ("오프라인에서도 되나요?", "한 번 열면 앱 파일이 저장되어 오프라인으로 열립니다. 외부로 보내는 요청이 없습니다."),
    ]
    cw, ch = 6.05, 1.02
    for i, (q, a) in enumerate(qa):
        col, row = i % 2, i // 2
        x = 0.5 + col * (cw + 0.23)
        y = CY + row * (ch + 0.13)
        rbox(s, x, y, cw, ch)
        text(s, x + 0.15, y + 0.08, 0.4, 0.32, "Q", 13, True, BLUE)
        text(s, x + 0.5, y + 0.08, cw - 0.65, 0.32, q, 12, True)
        text(s, x + 0.5, y + 0.42, cw - 0.65, 0.56, a, 10, False, SUB)


def back():
    s = new_slide()
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY
    grid(s, 0.8, 2.25, 11.7, 1.5)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(6.2), Inches(0.75), Inches(0.9), Inches(0.9))
    text(s, 0, 4.4, 13.333, 0.6, NAME, 30, True, WHITE, PP_ALIGN.CENTER)
    text(s, 0, 5.05, 13.333, 0.4, "레시피 파일만으로 기준 · 장비별 차이 · 1대 시범 → 전체 배포 · 롤백 묶음", 13, False, RGBColor(0xC9, 0xD3, 0xE0), PP_ALIGN.CENTER)
    text(s, 0, 5.7, 13.333, 0.6, [f"v{VERSION}   ·   만든 사람 배민혁   ·   MIT License   ·   © 2026",
                                  "포함: Pretendard (SIL OFL 1.1) · 예시 레시피 · 장비 · 화면은 모두 합성 데이터"],
         10, False, RGBColor(0x8A, 0x97, 0xA8), PP_ALIGN.CENTER)


def to_pdf(pptx):
    """PowerPoint COM 으로 PDF 저장 (Windows)."""
    pdf = os.path.splitext(pptx)[0] + ".pdf"
    ps = ("$p = New-Object -ComObject PowerPoint.Application; "
          f"$d = $p.Presentations.Open('{pptx}', $true, $false, $false); "
          f"$d.SaveAs('{pdf}', 32); $d.Close(); $p.Quit()")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    print("saved", pdf)


def main():
    cover()            # 1
    toc()              # 2
    intro()            # 3
    install()          # 4
    screens()          # 5–9
    flow_overview()    # 10
    verify()           # 11–16
    data()             # 17–20
    appendix()         # 21
    faq()              # 22
    back()             # 23
    assert state["n"] == TOTAL, state["n"]
    prs.save(OUT)
    print("saved", OUT)
    if "--pdf" in sys.argv:
        to_pdf(OUT)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
