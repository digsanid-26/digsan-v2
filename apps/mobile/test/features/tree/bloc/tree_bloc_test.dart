import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:digsan_mobile/data/models/family_tree_model.dart';
import 'package:digsan_mobile/data/repositories/tree_repository.dart';
import 'package:digsan_mobile/features/tree/bloc/tree_bloc.dart';
import 'package:digsan_mobile/features/tree/bloc/tree_event.dart';
import 'package:digsan_mobile/features/tree/bloc/tree_state.dart';

class MockTreeRepository extends Mock implements TreeRepository {}

void main() {
  late MockTreeRepository mockRepo;

  setUp(() {
    mockRepo = MockTreeRepository();
  });

  final sampleTrees = [
    FamilyTreeModel(
      id: 't1',
      userId: 'u1',
      name: 'Keluarga Besar',
      memberCount: 5,
      createdAt: DateTime.utc(2026),
      updatedAt: DateTime.utc(2026),
    ),
  ];

  group('TreeBloc', () {
    blocTest<TreeBloc, TreeState>(
      'emits [TreeLoading, TreeListLoaded] on TreeLoadRequested success',
      build: () {
        when(() => mockRepo.getTrees()).thenAnswer((_) async => sampleTrees);
        return TreeBloc(mockRepo);
      },
      act: (bloc) => bloc.add(TreeLoadRequested()),
      expect: () => [
        TreeLoading(),
        TreeListLoaded(sampleTrees),
      ],
    );

    blocTest<TreeBloc, TreeState>(
      'emits [TreeLoading, TreeError] on TreeLoadRequested failure',
      build: () {
        when(() => mockRepo.getTrees()).thenThrow(Exception('Network error'));
        return TreeBloc(mockRepo);
      },
      act: (bloc) => bloc.add(TreeLoadRequested()),
      expect: () => [
        TreeLoading(),
        isA<TreeError>(),
      ],
    );

    blocTest<TreeBloc, TreeState>(
      'emits [TreeLoading, TreeMembersLoaded] on TreeMembersLoadRequested',
      build: () {
        when(() => mockRepo.getMembers('t1')).thenAnswer((_) async => [
              FamilyMemberModel(
                id: 'm1',
                treeId: 't1',
                name: 'Pak Ahmad',
                gender: 'MALE',
              ),
            ]);
        return TreeBloc(mockRepo);
      },
      act: (bloc) => bloc.add(const TreeMembersLoadRequested('t1')),
      expect: () => [
        TreeLoading(),
        isA<TreeMembersLoaded>(),
      ],
    );
  });
}
