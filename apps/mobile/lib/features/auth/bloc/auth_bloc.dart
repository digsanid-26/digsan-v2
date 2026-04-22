import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import '../../../data/repositories/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepository;

  AuthBloc(this._authRepository) : super(AuthInitial()) {
    on<AuthCheckRequested>(_onCheckRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthRegisterRequested>(_onRegisterRequested);
    on<AuthForgotPasswordRequested>(_onForgotPasswordRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
  }

  Future<void> _onCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    final loggedIn = await _authRepository.isLoggedIn();
    if (!loggedIn) {
      emit(AuthUnauthenticated());
      return;
    }
    try {
      final user = await _authRepository.getProfile();
      emit(AuthAuthenticated(user: user));
    } catch (_) {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> _onLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      final data = await _authRepository.login(event.email, event.password);
      final user = data['user'] as Map<String, dynamic>;
      emit(AuthAuthenticated(user: user));
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Login gagal';
      emit(AuthError(message: msg is List ? msg.first : msg.toString()));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onRegisterRequested(
    AuthRegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await _authRepository.register(
        email: event.email,
        name: event.name,
        password: event.password,
        phone: event.phone,
      );
      emit(const AuthRegistered(
        message: 'Registrasi berhasil! Cek email untuk verifikasi.',
      ));
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Registrasi gagal';
      emit(AuthError(message: msg is List ? msg.first : msg.toString()));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onForgotPasswordRequested(
    AuthForgotPasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      await _authRepository.forgotPassword(event.email);
      emit(const AuthForgotPasswordSent(
        message: 'Link reset password telah dikirim ke email Anda.',
      ));
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Gagal mengirim';
      emit(AuthError(message: msg is List ? msg.first : msg.toString()));
    } catch (e) {
      emit(AuthError(message: e.toString()));
    }
  }

  Future<void> _onLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    await _authRepository.logout();
    emit(AuthUnauthenticated());
  }
}
