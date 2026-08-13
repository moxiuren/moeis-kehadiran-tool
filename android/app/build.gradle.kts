plugins {
    id("com.android.application")
}

android {
    namespace = "com.moxi.moeiskehadiran"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.2.0"
    }

    flavorDimensions.add("mode")
    productFlavors {
        create("script") {
            dimension = "mode"
            applicationId = "com.moxi.moeiskehadiran"
            manifestPlaceholders["appName"] = "MOEIS点名"
        }
        create("calendar") {
            dimension = "mode"
            applicationId = "com.moxi.moeiscalendar"
            manifestPlaceholders["appName"] = "MOEIS日历点名"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
}