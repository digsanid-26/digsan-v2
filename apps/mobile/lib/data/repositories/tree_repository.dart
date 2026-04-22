import '../../core/network/api_client.dart';
import '../models/family_tree_model.dart';

class TreeRepository {
  final ApiClient _api;

  TreeRepository(this._api);

  dynamic _unwrap(dynamic data) {
    if (data is Map && data['data'] != null) return data['data'];
    return data;
  }

  Future<List<FamilyTreeModel>> getTrees() async {
    final res = await _api.dio.get('/trees');
    final list = _unwrap(res.data);
    if (list is List) {
      return list.map((e) => FamilyTreeModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<FamilyTreeModel> createTree({required String name, String? description}) async {
    final res = await _api.dio.post('/trees', data: {
      'name': name,
      'description': ?description,
    });
    return FamilyTreeModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<List<FamilyMemberModel>> getMembers(String treeId) async {
    final res = await _api.dio.get('/trees/$treeId/members');
    final data = _unwrap(res.data);
    final list = data is Map && data['members'] != null ? data['members'] as List : data is List ? data : [];
    return list.map((e) => FamilyMemberModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<FamilyMemberModel> addMember(String treeId, Map<String, dynamic> memberData) async {
    final res = await _api.dio.post('/trees/$treeId/members', data: memberData);
    return FamilyMemberModel.fromJson(_unwrap(res.data) as Map<String, dynamic>);
  }

  Future<void> deleteTree(String treeId) async {
    await _api.dio.delete('/trees/$treeId');
  }

  Future<void> deleteMember(String treeId, String memberId) async {
    await _api.dio.delete('/trees/$treeId/members/$memberId');
  }
}
