package com.moxi.moeiskehadiran;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final String TAB_URL = "https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru";
    private static final String PREFS = "moeis_creds";
    private static final String KEY_IC = "ic";
    private static final String KEY_PW = "pw";

    private WebView web;
    private ProgressBar progress;
    private SharedPreferences prefs;
    private String lastPageUrl = "";
    private int samePageHits = 0;
    private LinearLayout loadingOverlay;


    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WebView.setWebContentsDebuggingEnabled(true);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#f0f2f5"));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void log(String s) {
                android.util.Log.i("MOEIS_D", s);
            }

            @android.webkit.JavascriptInterface
            public void dismissLoader() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (loadingOverlay != null && loadingOverlay.getVisibility() == android.view.View.VISIBLE) {
                            loadingOverlay.animate()
                                    .alpha(0f)
                                    .setDuration(350)
                                    .withEndAction(new Runnable() {
                                        @Override
                                        public void run() {
                                            loadingOverlay.setVisibility(android.view.View.GONE);
                                        }
                                    }).start();
                        }
                    }
                });
            }
        }, "MoxiBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progress.setVisibility(ViewGroup.GONE);
                String u = url == null ? "" : url;
                boolean same = u.equals(lastPageUrl);
                lastPageUrl = u;
                samePageHits = same ? samePageHits + 1 : 0;
                if (samePageHits > 8) {
                    toast("自动登录连续受阻，请手动操作页面");
                    return;
                }
                route(u);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                android.util.Log.e("MOEIS_D", "WebView Error: code=" + errorCode + " desc=" + description + " url=" + failingUrl);
            }

            @android.annotation.TargetApi(android.os.Build.VERSION_CODES.M)
            @Override
            public void onReceivedError(WebView view, android.webkit.WebResourceRequest request, android.webkit.WebResourceError error) {
                super.onReceivedError(view, request, error);
                android.util.Log.e("MOEIS_D", "WebView Error M: code=" + error.getErrorCode() + " desc=" + error.getDescription() + " url=" + request.getUrl().toString());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progress.setVisibility(ViewGroup.VISIBLE);
                    progress.setProgress(newProgress);
                }
            }

            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                android.util.Log.i("MOEIS_JS", m.message());
                return true;
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#2e7d32")));
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 6);
        pp.gravity = Gravity.TOP;
        root.addView(progress, pp);

        LinearLayout fab = new LinearLayout(this);
        fab.setOrientation(LinearLayout.HORIZONTAL);
        fab.setPadding(36, 8, 14, 8);
        fab.setBackgroundColor(Color.parseColor("#1565c0"));
        fab.setElevation(20);
        TextView fabTxt = new TextView(this);
        fabTxt.setText("设置 / 重登");
        fabTxt.setTextColor(Color.WHITE);
        fabTxt.setTextSize(12);
        fab.addView(fabTxt);
        FrameLayout.LayoutParams fp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fp.gravity = Gravity.BOTTOM | Gravity.RIGHT;
        fp.setMargins(0, 0, 12, 16);
        fab.setOnClickListener(v -> showCredsDialog(true));
        root.addView(fab, fp);

        // 创建高保真 Loading 遮罩覆盖到最顶层，防止页面跳转闪烁
        loadingOverlay = new LinearLayout(this);
        loadingOverlay.setOrientation(LinearLayout.VERTICAL);
        loadingOverlay.setGravity(Gravity.CENTER);
        loadingOverlay.setBackgroundColor(Color.parseColor("#1565c0"));
        
        ProgressBar spinner = new ProgressBar(this, null, android.R.attr.progressBarStyleLarge);
        spinner.getIndeterminateDrawable().setColorFilter(Color.WHITE, android.graphics.PorterDuff.Mode.SRC_IN);
        
        TextView tv = new TextView(this);
        tv.setText("正在建立 MOEIS 安全连接...");
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(14);
        tv.setGravity(Gravity.CENTER);
        
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = 40;
        loadingOverlay.addView(spinner, lp);
        loadingOverlay.addView(tv);

        root.addView(loadingOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);

        // 启动 10 秒超时安全锁：防止在网络差、需要手动滑块验证或 idMe 崩溃时永久卡死在加载画面
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (loadingOverlay != null && loadingOverlay.getVisibility() == View.VISIBLE) {
                    android.util.Log.w("MOEIS_D", "TIMEOUT: Auto dismissing loader cover");
                    loadingOverlay.animate()
                            .alpha(0f)
                            .setDuration(350)
                            .withEndAction(new Runnable() {
                                @Override
                                public void run() {
                                    loadingOverlay.setVisibility(View.GONE);
                                }
                            }).start();
                }
            }
        }, 10000); // 10秒后无条件释放遮罩

        web.loadUrl(TAB_URL);
    }

    private void route(String url) {
        if (url.contains("loginverification")) {
            autoLoginStep2();
        } else if (url.contains("idme.moe.gov.my/login")) {
            autoLoginStep1();
        } else if (url.equals("https://idme.moe.gov.my/home") || url.startsWith("https://idme.moe.gov.my/home")) {
            web.loadUrl("https://idme.moe.gov.my/list_aplikasi");
        } else if (url.equals("https://idme.moe.gov.my/list_aplikasi") || url.startsWith("https://idme.moe.gov.my/list_aplikasi")) {
            gotoMoeispelFromApps();
        } else if (url.startsWith("https://moeispel.moe.gov.my/") && !url.contains("/sahsiah/kehadiran/tabguru")) {
            web.loadUrl(TAB_URL);
        } else if (url.contains("/sahsiah/kehadiran/tabguru")) {
            injectPanel();
        }
    }

    private String ic() {
        return prefs.getString(KEY_IC, "");
    }

    private String pw() {
        return prefs.getString(KEY_PW, "");
    }

    private boolean hasCreds() {
        return !ic().isEmpty() && !pw().isEmpty();
    }

    private void autoLoginStep1() {
        if (!hasCreds()) {
            toast("请输入教师账号凭证");
            showCredsDialog(false);
            return;
        }
        String js = "(function(){"
                + "var t=0;var iv=setInterval(function(){"
                + "var i=document.querySelector('#ic');"
                + "if(i){clearInterval(iv);i.value=" + jsStr(ic()) + ";"
                + "var f=i.closest('form');if(f)f.submit();"
                + "}else if(++t>30){clearInterval(iv);} },200);})();";
        eval(js);
    }

    private void autoLoginStep2() {
        if (!hasCreds()) {
            toast("请输入教师账号凭证");
            showCredsDialog(false);
            return;
        }
        String js = "(function(){"
                + "var t=0;var iv=setInterval(function(){"
                + "var c=document.querySelector('#check_log');"
                + "if(c){clearInterval(iv);"
                + "if(!c.checked){c.click();}"
                + "var t2=0;var iv2=setInterval(function(){"
                + "var p=document.querySelector('#password');"
                + "if(p){clearInterval(iv2);"
                + "p.value=" + jsStr(pw()) + ";"
                + "var ic=document.querySelector('#ic');if(ic)ic.value=" + jsStr(ic()) + ";"
                + "var f=p.closest('form');if(f)f.submit();"
                + "}else if(++t2>30){clearInterval(iv2);} },200);"
                + "}else if(++t>30){clearInterval(iv);} },200);})();";
        eval(js);
    }

    private void gotoMoeispelFromApps() {
        String js = "(function(){"
                + "var t=0;var iv=setInterval(function(){"
                + "var a=document.querySelector('a[href*=\"moeispel\"]');"
                + "if(a){clearInterval(iv);window.location.href=a.href;"
                + "}else if(++t>30){clearInterval(iv);} },200);})();";
        eval(js);
    }

    private void injectPanel() {
        String js;
        try {
            js = loadAsset("kehadiran_panel.js");
        } catch (Exception e) {
            toast("面板脚本加载失败");
            return;
        }
        eval(js);
        String diag = "(function(){"
                + "MoxiBridge.log('DIAG: Installing absent student Kemaskini logger');"
                + "document.addEventListener('click', function(e){"
                + "var t = e.target;"
                + "if(t && (t.id === 'moeis-ka-sah' || t.id === 'moeis-ka-all' || t.id === 'moeis-ka-save')){"
                + "MoxiBridge.log('DIAG: CLICKED ' + t.id);"
                + "var trs = document.querySelectorAll('#kehadiran tbody tr');"
                + "trs.forEach(function(tr, idx){"
                + "var cb = tr.querySelector('.case-hadir');"
                + "if(cb && !cb.checked){"
                + "var kat = tr.querySelector('.selectkategori');"
                + "var seb = tr.querySelector('.selectsebab');"
                + "MoxiBridge.log('DIAG: absent_student['+idx+'] katVal='+(kat?kat.value:'null')+' sebVal='+(seb?seb.value:'null')+' jqKatVal='+(window.jQuery?window.jQuery(kat).val():'nojq')+' jqSebVal='+(window.jQuery?window.jQuery(seb).val():'nojq'));"
                + "}"
                + "});"
                + "var cc = 0;"
                + "var iv = setInterval(function(){"
                + "var sws = document.querySelectorAll('.sweet-alert, .swal2-modal, .swal-modal, div[role=dialog]');"
                + "MoxiBridge.log('DIAG: tick ' + cc + ' modals=' + sws.length);"
                + "sws.forEach(function(sw, i){"
                + "MoxiBridge.log('DIAG: sw['+i+'] vis='+(sw.offsetWidth>0&&sw.offsetHeight>0)+' text=\"'+sw.textContent.substring(0,150).replace(/\\n/g,' ')+'\"');"
                + "var btns = sw.querySelectorAll('button, a.btn, input[type=button]');"
                + "btns.forEach(function(b, j){ MoxiBridge.log('DIAG: sw['+i+']_btn['+j+'] cls=\"'+b.className+'\" txt=\"'+b.textContent.trim()+'\"'); });"
                + "});"
                + "if(++cc > 30){ clearInterval(iv); }"
                + "}, 200);"
                + "}"
                + "});"
                + "})();";
        eval(diag);
    }

    private String loadAsset(String name) throws Exception {
        java.io.InputStream is = getAssets().open(name);
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        is.close();
        return new String(bos.toByteArray(), "UTF-8");
    }

    private void eval(String js) {
        web.evaluateJavascript(js, val -> {
            if (val != null && !val.equals("null")) {
                android.util.Log.i("MOEIS_D", "EVAL_RES: " + val);
            }
        });
    }

    private String jsStr(String v) {
        return JSONObject.quote(v == null ? "" : v);
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    private void showCredsDialog(boolean allowReLogin) {
        if (loadingOverlay != null) {
            loadingOverlay.setVisibility(View.GONE);
        }
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(60, 20, 60, 0);

        EditText icInput = new EditText(this);
        icInput.setHint("Nombor Kad Pengenalan (IC)");
        icInput.setInputType(InputType.TYPE_CLASS_TEXT);
        icInput.setText(ic());
        box.addView(icInput);

        EditText pwInput = new EditText(this);
        pwInput.setHint("Kata Laluan");
        pwInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pwInput.setText(pw());
        box.addView(pwInput);

        AlertDialog.Builder b = new AlertDialog.Builder(this);
        b.setTitle("教师账号凭证");
        b.setMessage("仅保存在本机，用于自动登录 idMe");
        b.setView(box);
        b.setCancelable(false);
        b.setPositiveButton("保存", (d, w) -> {
            prefs.edit()
                    .putString(KEY_IC, icInput.getText().toString().trim())
                    .putString(KEY_PW, pwInput.getText().toString())
                    .apply();
            web.reload();
        });
        if (allowReLogin) {
            b.setNeutralButton("重登", (d, w) -> {
                CookieManager.getInstance().removeAllCookies(null);
                CookieManager.getInstance().flush();
                lastPageUrl = "";
                samePageHits = 0;
                if (loadingOverlay != null) {
                    loadingOverlay.setAlpha(1f);
                    loadingOverlay.setVisibility(android.view.View.VISIBLE);
                }
                web.loadUrl(TAB_URL);
            });
        }
        b.setNegativeButton("取消", (d, w) -> {
        });
        b.show();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}