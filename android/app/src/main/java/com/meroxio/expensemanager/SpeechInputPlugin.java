package com.meroxio.expensemanager;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Build;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
  name = "SpeechInput",
  permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
  }
)
public class SpeechInputPlugin extends Plugin {
  private SpeechRecognizer recognizer;

  @PluginMethod
  public void listen(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      requestPermissionForAlias("microphone", call, "speechPermissionCallback");
      return;
    }
    startListening(call);
  }

  @PermissionCallback
  private void speechPermissionCallback(PluginCall call) {
    if (getPermissionState("microphone") == PermissionState.GRANTED) {
      startListening(call);
    } else {
      call.reject("Mic permission denied");
    }
  }

  private void startListening(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
        call.reject("Speech recognition is not available on this device");
        return;
      }

      if (recognizer != null) {
        recognizer.destroy();
      }

      recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
      recognizer.setRecognitionListener(new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onPartialResults(Bundle partialResults) {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onError(int error) {
          cleanup();
          call.reject("Speech input stopped. Please try again.");
        }

        @Override
        public void onResults(Bundle results) {
          ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
          cleanup();
          JSObject result = new JSObject();
          result.put("transcript", matches != null && !matches.isEmpty() ? matches.get(0) : "");
          call.resolve(result);
        }
      });

      Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      String language = call.getString("language", "auto");
      if (!"auto".equals(language)) {
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        intent.putExtra(RecognizerIntent.EXTRA_ENABLE_LANGUAGE_DETECTION, true);
        intent.putStringArrayListExtra(RecognizerIntent.EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES, new ArrayList<>(java.util.Arrays.asList("en-IN", "hi-IN")));
      }
      intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
      recognizer.startListening(intent);
    });
  }

  private void cleanup() {
    if (recognizer != null) {
      recognizer.destroy();
      recognizer = null;
    }
  }
}
