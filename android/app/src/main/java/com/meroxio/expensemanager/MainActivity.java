package com.meroxio.expensemanager;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(BiometricAuthPlugin.class);
    registerPlugin(SecureCredentialStorePlugin.class);
    registerPlugin(SpeechInputPlugin.class);
    registerPlugin(PdfExportPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
