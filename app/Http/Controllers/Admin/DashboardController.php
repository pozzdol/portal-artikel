<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ArticleStatus;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Category;
use App\Models\Media;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $counts = Article::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $count = fn (ArticleStatus $status) => (int) ($counts[$status->value] ?? 0);

        return Inertia::render('Dashboard', [
            'counts' => [
                'draft' => $count(ArticleStatus::Draft),
                'returned' => $count(ArticleStatus::Returned),
                'in_review' => $count(ArticleStatus::InReview),
                'scheduled' => $count(ArticleStatus::Scheduled),
                'published' => $count(ArticleStatus::Published),
                'archived' => $count(ArticleStatus::Archived),
            ],

            'recent' => Article::query()
                ->with(['author:id,name,pen_name', 'category:id,name'])
                ->latest('updated_at')
                ->take(5)
                ->get()
                ->map(fn (Article $article) => [
                    'id' => $article->id,
                    'title' => $article->title,
                    'status' => $article->status->value,
                    'statusLabel' => $article->status->label(),
                    'category' => $article->category?->name,
                    'author' => $article->author?->byline,
                    'updatedAt' => $article->updated_at?->diffForHumans(),
                ]),

            'topCategories' => Category::query()
                ->where('is_active', true)
                ->withCount(['articles as published_count' => fn ($q) => $q->where('status', ArticleStatus::Published)])
                ->orderByDesc('published_count')
                ->orderBy('order')
                ->take(5)
                ->get()
                ->map(fn (Category $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'isNav' => $category->is_nav,
                    'published' => $category->published_count,
                ]),

            'library' => [
                'mediaCount' => Media::count(),
                'mediaBytes' => (int) Media::sum('size'),
            ],
        ]);
    }
}
