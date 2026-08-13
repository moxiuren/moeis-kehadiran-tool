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
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String PREFS = "moeis_calendar_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    
    // 默认备选地址
    private static final String DEFAULT_LAN_URL = "http://192.168.8.110:18930/";
    private static final String DEFAULT_TAILSCALE_URL = "http://100.107.104.44:18930/";

    private WebView web;
    private ProgressBar progress;
    private SharedPreferences prefs;
    private String currentLoadingUrl = "";
    
    // 标记当前重试的状态，防死循环
    private boolean triedTailscale = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WebView.setWebContentsDebuggingEnabled(true);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#f5f7fa"));

        // 初始化 WebView
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progress.setVisibility(ViewGroup.GONE);
                // 页面正常加载完成，重置重试标记
                if (url != null && !url.equals("about:blank")) {
                    triedTailscale = false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // 仅针对主页面请求失败进行错误处理
                if (request.isForMainFrame()) {
                    handleConnectionError(view.getUrl());
                }
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // 兼容低版本
                handleConnectionError(failingUrl);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progress.setVisibility(ViewGroup.VISIBLE);
                    progress.setProgress(newProgress);
                } else {
                    progress.setVisibility(ViewGroup.GONE);
                }
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // 顶端横向进度条
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#1565c0")));
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 8);
        pp.gravity = Gravity.TOP;
        root.addView(progress, pp);

        // 半透明悬浮设置按钮 (FAB)
        LinearLayout fab = new LinearLayout(this);
        fab.setOrientation(LinearLayout.HORIZONTAL);
        fab.setPadding(28, 16, 28, 16);
        
        // 渲染成圆角按钮
        android.graphics.drawable.GradientDrawable gd = new android.graphics.drawable.GradientDrawable();
        gd.setColor(Color.parseColor("#801565c0")); // 50% 不透明蓝
        gd.setCornerRadius(40f);
        fab.setBackground(gd);
        fab.setElevation(8);
        
        TextView fabTxt = new TextView(this);
        fabTxt.setText("⚙ 服务端设置");
        fabTxt.setTextColor(Color.WHITE);
        fabTxt.setTextSize(11);
        fab.addView(fabTxt);
        
        FrameLayout.LayoutParams fp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fp.gravity = Gravity.BOTTOM | Gravity.END;
        fp.setMargins(0, 0, 16, 24);
        
        fab.setOnClickListener(v -> showServerConfigDialog());
        root.addView(fab, fp);

        setContentView(root);

        // 加载服务网页
        loadTargetUrl();
    }

    private void loadTargetUrl() {
        String savedUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_LAN_URL);
        currentLoadingUrl = savedUrl;
        web.loadUrl(savedUrl);
    }

    private void handleConnectionError(String failingUrl) {
        if (failingUrl == null || failingUrl.equals("about:blank")) return;

        // 如果连不上局域网，且尚未尝试过 Tailscale，则自动切换 Tailscale IP 重试一次
        if (failingUrl.startsWith(DEFAULT_LAN_URL) && !triedTailscale) {
            triedTailscale = true;
            toast("局局域网连不上，正在自动尝试 Tailscale 地址...");
            currentLoadingUrl = DEFAULT_TAILSCALE_URL;
            web.loadUrl(DEFAULT_TAILSCALE_URL);
        } else {
            // 都失败，弹出配置框
            toast("连接服务端失败，请检查 Python 服务端是否已启动");
            showServerConfigDialog();
        }
    }

    private void showServerConfigDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("配置点名服务端 IP");
        builder.setMessage("请输入运行 server.py 后端服务的局域网 IP 或 Tailscale IP（例如 http://192.168.8.110:18930/）");

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        String currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_LAN_URL);
        input.setText(currentUrl);
        input.setSelection(currentUrl.length());
        
        // 内间距
        FrameLayout container = new FrameLayout(this);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.leftMargin = 50;
        params.rightMargin = 50;
        params.topMargin = 20;
        params.bottomMargin = 20;
        input.setLayoutParams(params);
        container.addView(input);
        
        builder.setView(container);

        builder.setPositiveButton("确定并连接", (dialog, which) -> {
            String newUrl = input.getText().toString().trim();
            if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                newUrl = "http://" + newUrl;
            }
            if (!newUrl.endsWith("/")) {
                newUrl = newUrl + "/";
            }
            
            // 写入本地 SharedPreferences 缓存
            prefs.edit().putString(KEY_SERVER_URL, newUrl).apply();
            triedTailscale = false; // 重置标记
            toast("正在连接: " + newUrl);
            currentLoadingUrl = newUrl;
            web.loadUrl(newUrl);
        });
        
        builder.setNegativeButton("取消", (dialog, which) -> dialog.cancel());
        
        // 允许直接加载备选
        builder.setNeutralButton("重试备用IP", (dialog, which) -> {
            triedTailscale = false;
            loadTargetUrl();
        });

        builder.show();
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
