import 'package:equatable/equatable.dart';
import '../../../data/models/family_tree_model.dart';

abstract class TreeState extends Equatable {
  const TreeState();
  @override
  List<Object?> get props => [];
}

class TreeInitial extends TreeState {}

class TreeLoading extends TreeState {}

class TreeListLoaded extends TreeState {
  final List<FamilyTreeModel> trees;
  const TreeListLoaded(this.trees);
  @override
  List<Object?> get props => [trees];
}

class TreeMembersLoaded extends TreeState {
  final String treeId;
  final List<FamilyMemberModel> members;
  const TreeMembersLoaded({required this.treeId, required this.members});
  @override
  List<Object?> get props => [treeId, members];
}

class TreeOperationSuccess extends TreeState {
  final String message;
  const TreeOperationSuccess(this.message);
  @override
  List<Object?> get props => [message];
}

class TreeError extends TreeState {
  final String message;
  const TreeError(this.message);
  @override
  List<Object?> get props => [message];
}
