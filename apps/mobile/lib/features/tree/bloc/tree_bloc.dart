import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/repositories/tree_repository.dart';
import 'tree_event.dart';
import 'tree_state.dart';

class TreeBloc extends Bloc<TreeEvent, TreeState> {
  final TreeRepository _repository;

  TreeBloc(this._repository) : super(TreeInitial()) {
    on<TreeLoadRequested>(_onLoad);
    on<TreeCreateRequested>(_onCreate);
    on<TreeDeleteRequested>(_onDelete);
    on<TreeMembersLoadRequested>(_onLoadMembers);
    on<TreeMemberAddRequested>(_onAddMember);
  }

  Future<void> _onLoad(TreeLoadRequested event, Emitter<TreeState> emit) async {
    emit(TreeLoading());
    try {
      final trees = await _repository.getTrees();
      emit(TreeListLoaded(trees));
    } on DioException catch (e) {
      emit(TreeError(e.response?.data?['message']?.toString() ?? 'Gagal memuat silsilah'));
    } catch (e) {
      emit(TreeError(e.toString()));
    }
  }

  Future<void> _onCreate(TreeCreateRequested event, Emitter<TreeState> emit) async {
    emit(TreeLoading());
    try {
      await _repository.createTree(name: event.name, description: event.description);
      emit(const TreeOperationSuccess('Silsilah berhasil dibuat'));
      add(TreeLoadRequested());
    } on DioException catch (e) {
      emit(TreeError(e.response?.data?['message']?.toString() ?? 'Gagal membuat silsilah'));
    } catch (e) {
      emit(TreeError(e.toString()));
    }
  }

  Future<void> _onDelete(TreeDeleteRequested event, Emitter<TreeState> emit) async {
    emit(TreeLoading());
    try {
      await _repository.deleteTree(event.treeId);
      emit(const TreeOperationSuccess('Silsilah berhasil dihapus'));
      add(TreeLoadRequested());
    } on DioException catch (e) {
      emit(TreeError(e.response?.data?['message']?.toString() ?? 'Gagal menghapus silsilah'));
    } catch (e) {
      emit(TreeError(e.toString()));
    }
  }

  Future<void> _onLoadMembers(TreeMembersLoadRequested event, Emitter<TreeState> emit) async {
    emit(TreeLoading());
    try {
      final members = await _repository.getMembers(event.treeId);
      emit(TreeMembersLoaded(treeId: event.treeId, members: members));
    } on DioException catch (e) {
      emit(TreeError(e.response?.data?['message']?.toString() ?? 'Gagal memuat anggota'));
    } catch (e) {
      emit(TreeError(e.toString()));
    }
  }

  Future<void> _onAddMember(TreeMemberAddRequested event, Emitter<TreeState> emit) async {
    emit(TreeLoading());
    try {
      await _repository.addMember(event.treeId, event.memberData);
      emit(const TreeOperationSuccess('Anggota berhasil ditambahkan'));
      add(TreeMembersLoadRequested(event.treeId));
    } on DioException catch (e) {
      emit(TreeError(e.response?.data?['message']?.toString() ?? 'Gagal menambah anggota'));
    } catch (e) {
      emit(TreeError(e.toString()));
    }
  }
}
