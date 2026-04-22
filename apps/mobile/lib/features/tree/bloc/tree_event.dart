import 'package:equatable/equatable.dart';

abstract class TreeEvent extends Equatable {
  const TreeEvent();
  @override
  List<Object?> get props => [];
}

class TreeLoadRequested extends TreeEvent {}

class TreeCreateRequested extends TreeEvent {
  final String name;
  final String? description;
  const TreeCreateRequested({required this.name, this.description});
  @override
  List<Object?> get props => [name, description];
}

class TreeDeleteRequested extends TreeEvent {
  final String treeId;
  const TreeDeleteRequested(this.treeId);
  @override
  List<Object?> get props => [treeId];
}

class TreeMembersLoadRequested extends TreeEvent {
  final String treeId;
  const TreeMembersLoadRequested(this.treeId);
  @override
  List<Object?> get props => [treeId];
}

class TreeMemberAddRequested extends TreeEvent {
  final String treeId;
  final Map<String, dynamic> memberData;
  const TreeMemberAddRequested({required this.treeId, required this.memberData});
  @override
  List<Object?> get props => [treeId, memberData];
}
