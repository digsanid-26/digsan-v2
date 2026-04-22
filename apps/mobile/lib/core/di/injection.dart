import 'package:get_it/get_it.dart';
import '../network/api_client.dart';
import '../network/socket_service.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/tree_repository.dart';
import '../../data/repositories/chat_repository.dart';
import '../../data/repositories/notification_repository.dart';
import '../../data/repositories/gamification_repository.dart';
import '../../data/repositories/job_repository.dart';
import '../../features/auth/bloc/auth_bloc.dart';
import '../../features/tree/bloc/tree_bloc.dart';
import '../../features/chat/bloc/chat_bloc.dart';
import '../../features/notifications/bloc/notification_bloc.dart';
import '../../features/gamification/bloc/gamification_bloc.dart';

final getIt = GetIt.instance;

void setupDependencies() {
  // Core
  getIt.registerLazySingleton<ApiClient>(() => ApiClient());
  getIt.registerLazySingleton<SocketService>(
    () => SocketService(getIt<ApiClient>()),
  );

  // Repositories
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepository(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<TreeRepository>(
    () => TreeRepository(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<ChatRepository>(
    () => ChatRepository(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<NotificationRepository>(
    () => NotificationRepository(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<GamificationRepository>(
    () => GamificationRepository(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<JobRepository>(
    () => JobRepository(getIt<ApiClient>()),
  );

  // BLoCs
  getIt.registerFactory<AuthBloc>(
    () => AuthBloc(getIt<AuthRepository>()),
  );
  getIt.registerFactory<TreeBloc>(
    () => TreeBloc(getIt<TreeRepository>()),
  );
  getIt.registerFactory<ChatBloc>(
    () => ChatBloc(getIt<ChatRepository>()),
  );
  getIt.registerFactory<NotificationBloc>(
    () => NotificationBloc(getIt<NotificationRepository>()),
  );
  getIt.registerFactory<GamificationBloc>(
    () => GamificationBloc(getIt<GamificationRepository>()),
  );
}
